const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const USERS_FILE = path.join(__dirname, 'users.json');
let users = require(USERS_FILE); // загружаем базу

// Сервисы
function saveUsers() {
    require('fs').writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Статика — отдаём фронтенд из client/public
app.use(express.static(path.join(__dirname, '../client/public')));

// Регистрация
app.post('/register', express.json(), (req, res) => {
    const { username, password } = req.body;
    if (users[username]) {
        return res.json({ success: false, message: 'Никнейм занят' });
    }
    const hash = bcrypt.hashSync(password, 10);
    users[username] = { hash, online: false };
    saveUsers();
    res.json({ success: true });
});

// Вход
app.post('/login', express.json(), (req, res) => {
    const { username, password } = req.body;
    const user = users[username];
    if (!user || !bcrypt.compareSync(password, user.hash)) {
        return res.json({ success: false });
    }
    user.online = true;
    saveUsers();
    res.json({ success: true });
});

// Получить список пользователей
app.get('/users', (req, res) => {
    res.json(Object.keys(users));
});

// WebSocket
wss.on('connection', (ws, req) => {
    let username = null;

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.type === 'join') {
            username = data.username;
            users[username].online = true;
            saveUsers();
            broadcastUsers();
        } else if (data.type === 'message') {
            const target = users[data.to];
            if (target && target.online) {
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN && client !== ws) {
                        const clientData = JSON.parse(client.request._rawHeaders.find(h => h === 'username'));
                        if (clientData === data.to) {
                            client.send(JSON.stringify({
                                type: 'message',
                                from: username,
                                text: data.text
                            }));
                        }
                    }
                });
            }
        }
    });

    ws.on('close', () => {
        if (username) {
            users[username].online = false;
            saveUsers();
            broadcastUsers();
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'userLeft',
                        username
                    }));
                }
            });
        }
    });
});

function broadcastUsers() {
    const userList = Object.keys(users);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'users',
                users: userList
            }));
        }
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});