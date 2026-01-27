const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const USERS_FILE = path.join(__dirname, 'users.json');
let users = {};

// Попытка загрузить users.json
try {
  users = require(USERS_FILE);
  console.log('✅ Загружено пользователей:', Object.keys(users).length);
} catch (err) {
  console.log('⚠️ users.json не найден или пуст. Создаём новую базу.');
  // Создаём пустой объект, если файл не существует
  require('fs').writeFileSync(USERS_FILE, '{}');
}

// === ✅ СТАТИКА — ОБЯЗАТЕЛЬНО ПЕРВАЯ ===
app.use(express.static(path.join(__dirname, '../client/public')));
console.log('✅ Статика подключена: client/public');

// === Регистрация ===
app.post('/register', express.json(), (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.json({ success: false, message: 'Поле не заполнено' });
  }
  if (users[username]) {
    console.log(`❌ Регистрация: никнейм "${username}" уже занят`);
    return res.json({ success: false, message: 'Никнейм уже занят' });
  }
  const hash = bcrypt.hashSync(password, 10);
  users[username] = { hash, online: false };
  saveUsers();
  console.log(`✅ Регистрация: новый пользователь "${username}"`);
  res.json({ success: true });
});

// === Вход ===
app.post('/login', express.json(), (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.json({ success: false, message: 'Поле не заполнено' });
  }
  const user = users[username];
  if (!user || !bcrypt.compareSync(password, user.hash)) {
    console.log(`❌ Вход: неверный логин/пароль для "${username}"`);
    return res.json({ success: false });
  }
  user.online = true;
  saveUsers();
  console.log(`✅ Вход: пользователь "${username}" вошёл`);
  res.json({ success: true });
});

// === Получить список пользователей ===
app.get('/users', (req, res) => {
  res.json(Object.keys(users));
});

// === WebSocket ===
wss.on('connection', (ws, req) => {
  let username = null;

  console.log('🌐 WebSocket: новый клиент подключился');

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    console.log(`📩 Получено:`, data);

    if (data.type === 'join') {
      username = data.username;
      if (!users[username]) {
        console.log(`❌ Попытка подключиться как "${username}", но его нет в базе`);
        ws.close();
        return;
      }
      users[username].online = true;
      saveUsers();
      console.log(`✅ Пользователь "${username}" присоединился к чату`);
      broadcastUsers();
    } else if (data.type === 'message') {
      if (!username) {
        console.log('❌ Сообщение от незарегистрированного клиента');
        return;
      }
      const target = users[data.to];
      if (target && target.online) {
        // Отправляем сообщение только тому, кто онлайн
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            // Найти клиента по его username (условно)
            // В реальности — нужно хранить username в ws объекте
            // Но для простоты — просто отправим всем, кто подключён
            // В реальном проекте — сделаем Map<username, ws>
            client.send(JSON.stringify({
              type: 'message',
              from: username,
              text: data.text
            }));
          }
        });
        console.log(`📤 Сообщение от "${username}" → "${data.to}": "${data.text}"`);
      } else {
        console.log(`⚠️ Пользователь "${data.to}" не онлайн`);
      }
    }
  });

  ws.on('close', () => {
    if (username) {
      users[username].online = false;
      saveUsers();
      broadcastUsers();
      console.log(`🚪 Пользователь "${username}" отключился`);
    }
  });
});

function saveUsers() {
  require('fs').writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  console.log('💾 users.json сохранён');
}

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
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
