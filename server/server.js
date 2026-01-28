const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const USERS_FILE = path.join(__dirname, 'users.json');
let users = {};

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

function saveUsers() {
    require('fs').writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

const activeConnections = new Map();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/public')));

// Проверка существования пользователя
app.post('/check-user', (req, res) => {
    const { username } = req.body;
    if (!username) return res.json({ success: false, message: 'Имя не указано' });
    const exists = users.hasOwnProperty(username);
    res.json({ exists, user: exists ? { username, online: false } : null });
});

// Поиск пользователя
app.post('/search-user', (req, res) => {
    const { username, searcher } = req.body;
    if (!username || !searcher) return res.json({ success: false, message: 'Данные не указаны' });
    if (username === searcher) return res.json({ success: false, message: 'Нельзя искать самого себя' });
    const exists = users.hasOwnProperty(username);
    if (!exists) return res.json({ success: false, message: 'Пользователь не найден' });
    res.json({
        success: true,
        user: {
            username: username,
            online: activeConnections.has(username)
        }
    });
});

// Регистрация
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Заполните все поля' });
    if (username.length < 2) return res.status(400).json({ success: false, message: 'Имя минимум 2 символа' });
    if (users.hasOwnProperty(username)) return res.status(409).json({ success: false, message: 'Никнейм занят' });
    const hash = bcrypt.hashSync(password, 10);
    users[username] = { hash };
    saveUsers();
    console.log(`✅ Зарегистрирован: ${username}`);
    res.json({ success: true, message: 'Регистрация успешна' });
});

// Вход
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Заполните все поля' });
    const user = users[username];
    if (!user || !bcrypt.compareSync(password, user.hash)) return res.status(401).json({ success: false, message: 'Неверный пароль' });
    console.log(`✅ Вход: ${username}`);
    res.json({ success: true, message: 'Вход выполнен' });
});

// Health Check для Render
app.get('/healthz', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'Maxutra Messenger',
        timestamp: new Date().toISOString(),
        users: Object.keys(users).length,
        online: activeConnections.size
    });
});

// WebSocket
wss.on('connection', (ws, req) => {
    let currentUser = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'register') {
                if (activeConnections.has(data.username)) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Уже онлайн' }));
                    return;
                }
                currentUser = data.username;
                activeConnections.set(currentUser, ws);
                broadcastUserList();
                broadcastSystemMessage(`${currentUser} присоединился`);
                console.log(`✅ ${currentUser} подключился`);
            }

            else if (data.type === 'callOffer') {
                const { from, to, offer } = data;
                const target = activeConnections.get(to);
                if (!target) {
                    ws.send(JSON.stringify({ type: 'callRejected', message: 'Пользователь не в сети' }));
                    return;
                }
                target.send(JSON.stringify({ type: 'callNotification', from, offer }));
                console.log(`📞 ${from} вызывает ${to}`);
            }

            else if (data.type === 'callAnswer') {
                const { from, to, answer } = data;
                const target = activeConnections.get(to);
                if (target) target.send(JSON.stringify({ type: 'callAccepted', answer }));
                console.log(`✅ ${from} принял вызов от ${to}`);
            }

            else if (data.type === 'callCandidate') {
                const { from, to, candidate } = data;
                const target = activeConnections.get(to);
                if (target) target.send(JSON.stringify({ type: 'callCandidate', from, candidate }));
            }

            else if (data.type === 'callRejected') {
                const { from, to } = data;
                const target = activeConnections.get(to);
                if (target) target.send(JSON.stringify({ type: 'callRejected', from }));
                console.log(`❌ ${from} отклонил вызов от ${to}`);
            }

            else if (data.type === 'message') {
                const { to, text } = data;
                const target = activeConnections.get(to);
                if (target) target.send(JSON.stringify({ type: 'message', from: currentUser, text, timestamp: new Date().toISOString() }));
            }

        } catch (err) {
            console.error('Ошибка:', err);
        }
    });

    ws.on('close', () => {
        if (currentUser) {
            activeConnections.delete(currentUser);
            broadcastUserList();
            broadcastSystemMessage(`${currentUser} покинул чат`);
            console.log(`❌ ${currentUser} отключился`);
        }
    });
});

function broadcastUserList() {
    const list = Array.from(activeConnections.keys());
    activeConnections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'userList', users: list }));
        }
    });
}

function broadcastSystemMessage(message) {
    const data = JSON.stringify({ type: 'system', message });
    activeConnections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });
}

loadUsers();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Health: http://localhost:${PORT}/healthz`);
});
