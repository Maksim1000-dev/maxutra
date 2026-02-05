const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/public')));

const USERS_FILE = path.join(__dirname, 'users.json');

// Загружаем пользователей
function loadUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.log('⚠️ users.json не найден. Создаём новый.');
    return {};
  }
}

// Сохраняем пользователей
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Регистрация
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Заполните все поля' });

  const users = loadUsers();
  if (users[username]) {
    return res.status(400).json({ error: 'Пользователь уже существует' });
  }

  const hash = bcrypt.hashSync(password, 10);
  users[username] = { password: hash };
  saveUsers(users);

  res.json({ success: true, username });
});

// Логин
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Заполните все поля' });

  const users = loadUsers();
  const user = users[username];
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(400).json({ error: 'Неверный логин или пароль' });
  }

  res.json({ success: true, username });
});

// Получить всех пользователей (для поиска)
app.get('/users', (req, res) => {
  const users = loadUsers();
  res.json(Object.keys(users));
});

// Socket.IO
io.on('connection', (socket) => {
  let username = null;

  socket.on('join', (user) => {
    username = user;
    socket.join(username);
    socket.username = username;
    console.log(`✅ ${username} подключился`);
  });

  socket.on('sendMessage', (data) => {
    const { text, receiver } = data;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const message = {
      text,
      sender: username,
      receiver,
      timestamp
    };

    if (!receiver) {
      // Глобальный чат
      io.emit('receiveMessage', message);
    } else {
      // Личное сообщение
      io.to(receiver).emit('receiveMessage', message);
      socket.emit('receiveMessage', message); // чтобы отправитель увидел своё сообщение
    }
  });

  socket.on('disconnect', () => {
    if (username) {
      console.log(`❌ ${username} отключился`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});
