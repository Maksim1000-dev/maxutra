let socket = null;
let currentUser = null;
let currentChatWith = null;

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
  const savedUser = localStorage.getItem('maxutra_user');
  if (savedUser) {
    currentUser = savedUser;
    showChatScreen();
    connectSocket();
  }
});

// Подключение WebSocket
function connectSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('✅ Подключено к серверу');
    if (currentUser) {
      socket.emit('join', currentUser);
    }
  });

  socket.on('receiveMessage', (msg) => {
    const messagesContainer = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = `message ${msg.sender === currentUser ? 'sent' : 'received'}`;
    div.textContent = `${msg.sender}: ${msg.text}`;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });

  socket.on('disconnect', () => {
    showChatMessage('❌ Соединение потеряно', 'error');
  });
}

// Регистрация
async function register() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    showAuthMessage('Заполните все поля', 'error');
    return;
  }

  try {
    const res = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.success) {
      showAuthMessage('Регистрация успешна! Войдите.', 'success');
      document.getElementById('username').value = '';
      document.getElementById('password').value = '';
    } else {
      showAuthMessage(data.error, 'error');
    }
  } catch (err) {
    showAuthMessage('Ошибка соединения', 'error');
  }
}

// Вход
async function login() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    showAuthMessage('Заполните все поля', 'error');
    return;
  }

  try {
    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.success) {
      currentUser = data.username;
      localStorage.setItem('maxutra_user', currentUser);
      showChatScreen();
      connectSocket();
    } else {
      showAuthMessage(data.error, 'error');
    }
  } catch (err) {
    showAuthMessage('Ошибка соединения', 'error');
  }
}

// Выход
function logout() {
  localStorage.removeItem('maxutra_user');
  currentUser = null;
  currentChatWith = null;
  document.getElementById('chat').classList.remove('active');
  document.getElementById('auth').classList.add('active');
  document.getElementById('messages').innerHTML = '';
  document.getElementById('users').innerHTML = '';
  if (socket) socket.disconnect();
}

// Показать сообщение
function showAuthMessage(message, type) {
  const el = document.getElementById('message');
  el.textContent = message;
  el.className = type;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3000);
}

// Показать сообщение в чате
function showChatMessage(message, type) {
  const messagesContainer = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'message system';
  div.style.backgroundColor = type === 'error' ? '#dc3545' : '#28a745';
  div.style.color = 'white';
  div.style.textAlign = 'center';
  div.style.padding = '10px';
  div.style.borderRadius = '10px';
  div.style.margin = '10px 0';
  div.textContent = message;
  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  setTimeout(() => div.remove(), 3000);
}

// Показать экран чата
function showChatScreen() {
  document.getElementById('auth').classList.remove('active');
  document.getElementById('chat').classList.add('active');
  document.getElementById('search').value = '';
  document.getElementById('users').innerHTML = '';
  document.getElementById('messages').innerHTML = '';
  loadUsers();
}

// Загрузить список пользователей
async function loadUsers() {
  try {
    const res = await fetch('/users');
    const users = await res.json();
    const usersList = document.getElementById('users');
    usersList.innerHTML = '';

    users.forEach(user => {
      const li = document.createElement('li');
      li.textContent = user;
      li.onclick = () => selectUser(user);
      usersList.appendChild(li);
    });
  } catch (err) {
    showChatMessage('Ошибка загрузки пользователей', 'error');
  }
}

// Поиск пользователей
function searchUsers() {
  const query = document.getElementById('search').value.toLowerCase();
  const items = document.querySelectorAll('#users li');

  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(query) ? 'block' : 'none';
  });
}

// Выбор пользователя
function selectUser(username) {
  if (username === currentUser) return;

  currentChatWith = username;
  document.querySelectorAll('#users li').forEach(el => el.classList.remove('active'));
  document.querySelector(`#users li:contains("${username}")`)?.classList.add('active');
  document.getElementById('messageInput').focus();
}

// Отправить сообщение
function sendMessage() {
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  if (!text || !currentChatWith) return;

  socket.emit('sendMessage', {
    text,
    receiver: currentChatWith
  });

  addMessage(currentUser, text, 'sent');
  input.value = '';
}

// Добавить сообщение
function addMessage(sender, text, type) {
  const messagesContainer = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = `message ${type}`;
  div.textContent = `${sender}: ${text}`;
  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Проверка наличия элемента с текстом (для CSS-селектора)
Element.prototype.contains = function(text) {
  return this.textContent.toLowerCase().includes(text.toLowerCase());
};
