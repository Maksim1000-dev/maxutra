const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// База данных пользователей
const USERS_FILE = path.join(__dirname, 'users.json');
let users = {};

// Загрузка пользователей из файла
function loadUsers() {
    try {
        const data = require('fs').readFileSync(USERS_FILE, 'utf8');
        users = JSON.parse(data);
        console.log(`✅ Загружено ${Object.keys(users).length} пользователей`);
    } catch (error) {
        console.log('⚠️ Файл users.json не найден, создаём новый');
        users = {};
        saveUsers();
    }
}

// Сохранение пользователей в файл
function saveUsers() {
    require('fs').writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Хранилище активных WebSocket соединений
const activeConnections = new Map();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/public')));

// ==================== REST API ====================

// Проверка существования пользователя
app.post('/check-user', (req, res) => {
    const { username } = req.body;
    
    if (!username) {
        return res.status(400).json({ success: false, message: 'Имя пользователя не указано' });
    }
    
    const userExists = users.hasOwnProperty(username);
    res.json({ 
        exists: userExists,
        user: userExists ? { username, online: activeConnections.has(username) } : null
    });
});

// Поиск пользователя
app.post('/search-user', (req, res) => {
    const { username, searcher } = req.body;
    
    if (!username || !searcher) {
        return res.status(400).json({ success: false, message: 'Данные не указаны' });
    }
    
    if (username === searcher) {
        return res.status(400).json({ success: false, message: 'Нельзя искать самого себя' });
    }
    
    const userExists = users.hasOwnProperty(username);
    
    if (!userExists) {
        return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }
    
    const user = users[username];
    res.json({
        success: true,
        user: {
            username: username,
            online: activeConnections.has(username)
        }
    });
});

// Регистрация нового пользователя
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Заполните все поля' });
    }
    
    if (username.length < 2) {
        return res.status(400).json({ success: false, message: 'Имя должно содержать минимум 2 символа' });
    }
    
    if (users.hasOwnProperty(username)) {
        return res.status(409).json({ success: false, message: 'Имя пользователя уже занято' });
    }
    
    // Хешируем пароль
    const hash = bcrypt.hashSync(password, 10);
    users[username] = { hash };
    saveUsers();
    
    console.log(`✅ Зарегистрирован новый пользователь: ${username}`);
    res.status(201).json({ success: true, message: 'Регистрация успешна' });
});

// Вход пользователя
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Заполните все поля' });
    }
    
    const user = users[username];
    
    if (!user) {
        return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }
    
    if (!bcrypt.compareSync(password, user.hash)) {
        return res.status(401).json({ success: false, message: 'Неверный пароль' });
    }
    
    console.log(`✅ Пользователь вошёл в систему: ${username}`);
    res.json({ success: true, message: 'Вход выполнен успешно' });
});

// ==================== HEALTH CHECKS ====================

// Health Check для Render.com (обязательный эндпоинт)
app.get('/healthz', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        service: 'Maxutra Messenger',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        users: {
            total: Object.keys(users).length,
            online: activeConnections.size
        }
    });
});

// Старый health check для обратной совместимости
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        message: 'Use /healthz for Render Health Checks',
        timestamp: new Date().toISOString()
    });
});

// ==================== WEB SOCKET ====================

wss.on('connection', (ws, req) => {
    let currentUser = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'register':
                    if (activeConnections.has(data.username)) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Пользователь уже онлайн'
                        }));
                        return;
                    }
                    
                    currentUser = data.username;
                    activeConnections.set(currentUser, ws);
                    broadcastUserList();
                    broadcastSystemMessage(`${currentUser} присоединился к чату`);
                    console.log(`✅ WebSocket: ${currentUser} подключился`);
                    break;
                    
                case 'message':
                    if (!currentUser) return;
                    
                    const targetUser = activeConnections.get(data.to);
                    if (targetUser && targetUser.readyState === WebSocket.OPEN) {
                        targetUser.send(JSON.stringify({
                            type: 'message',
                            from: currentUser,
                            text: data.text,
                            timestamp: data.timestamp
                        }));
                        
                        ws.send(JSON.stringify({
                            type: 'messageSent',
                            to: data.to,
                            text: data.text,
                            timestamp: data.timestamp
                        }));
                        
                        console.log(`📨 ${currentUser} → ${data.to}: ${data.text}`);
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Пользователь не в сети'
                        }));
                    }
                    break;
                    
                case 'userStatus':
                    const userExists = users.hasOwnProperty(data.username);
                    const isOnline = activeConnections.has(data.username);
                    
                    ws.send(JSON.stringify({
                        type: 'userStatus',
                        username: data.username,
                        exists: userExists,
                        online: isOnline
                    }));
                    break;
            }
        } catch (error) {
            console.error('Ошибка обработки WebSocket сообщения:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Ошибка обработки сообщения'
            }));
        }
    });

    ws.on('close', () => {
        if (currentUser) {
            activeConnections.delete(currentUser);
            broadcastUserList();
            broadcastSystemMessage(`${currentUser} покинул чат`);
            console.log(`❌ WebSocket: ${currentUser} отключился`);
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket ошибка:', error);
    });
});

function broadcastUserList() {
    const userList = Array.from(activeConnections.keys());
    const broadcastData = JSON.stringify({
        type: 'userList',
        users: userList
    });
    
    activeConnections.forEach((ws, username) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(broadcastData);
        }
    });
}

function broadcastSystemMessage(message) {
    const broadcastData = JSON.stringify({
        type: 'system',
        message: message,
        timestamp: new Date().toISOString()
    });
    
    activeConnections.forEach((ws, username) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(broadcastData);
        }
    });
}

// Загрузка пользователей при запуске
loadUsers();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📊 Health Checks:`);
    console.log(`   - Render Health: http://localhost:${PORT}/healthz`);
    console.log(`   - API Health: http://localhost:${PORT}/health`);
    console.log(`   - Пользователей в базе: ${Object.keys(users).length}`);
});
