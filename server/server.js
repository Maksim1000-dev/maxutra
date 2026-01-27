const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Хранилище пользователей и их WebSocket соединений
const users = new Map(); // username -> { ws, ... }

// Статические файлы
app.use(express.static(path.join(__dirname, '../client/public')));

// WebSocket обработчик
wss.on('connection', (ws, req) => {
    let currentUser = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'register':
                    // Регистрация нового пользователя
                    if (users.has(data.username)) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Имя пользователя уже занято'
                        }));
                        return;
                    }
                    
                    currentUser = data.username;
                    users.set(currentUser, { ws, online: true });
                    
                    // Уведомляем всех о новом пользователе
                    broadcastUserList();
                    broadcastSystemMessage(`${currentUser} присоединился к чату`);
                    
                    console.log(`✅ Пользователь ${currentUser} подключился`);
                    break;
                    
                case 'message':
                    // Отправка сообщения другому пользователю
                    if (!currentUser) return;
                    
                    const targetUser = users.get(data.to);
                    if (targetUser && targetUser.online) {
                        // Отправляем сообщение целевому пользователю
                        targetUser.ws.send(JSON.stringify({
                            type: 'message',
                            from: currentUser,
                            text: data.text,
                            timestamp: data.timestamp
                        }));
                        
                        console.log(`📨 ${currentUser} → ${data.to}: ${data.text}`);
                    }
                    break;
            }
        } catch (error) {
            console.error('Ошибка обработки сообщения:', error);
        }
    });

    ws.on('close', () => {
        if (currentUser) {
            users.delete(currentUser);
            broadcastUserList();
            broadcastSystemMessage(`${currentUser} покинул чат`);
            console.log(`❌ Пользователь ${currentUser} отключился`);
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket ошибка:', error);
    });
});

// Рассылка списка пользователей
function broadcastUserList() {
    const userList = Array.from(users.keys());
    
    users.forEach((userData, username) => {
        if (userData.ws.readyState === WebSocket.OPEN) {
            userData.ws.send(JSON.stringify({
                type: 'userList',
                users: userList
            }));
        }
    });
}

// Рассылка системного сообщения
function broadcastSystemMessage(message) {
    users.forEach((userData, username) => {
        if (userData.ws.readyState === WebSocket.OPEN) {
            userData.ws.send(JSON.stringify({
                type: 'system',
                message: message,
                timestamp: new Date().toISOString()
            }));
        }
    });
}

// Маршрут для проверки здоровья сервера
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        users: Array.from(users.keys()),
        timestamp: new Date().toISOString() 
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📊 Статистика:`);
    console.log(`   - WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`   - Health check: http://localhost:${PORT}/health`);
});
