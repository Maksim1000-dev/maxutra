let socket;
let currentUser = null;
let currentChatWith = null;

// Регистрация
async function register() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) return alert('Заполните все поля');

    const res = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (data.success) {
        alert('Регистрация успешна! Войдите.');
        document.getElementById('regSection').style.display = 'none';
        document.getElementById('loginSection').style.display = 'block';
    } else {
        document.getElementById('regError').style.display = 'block';
    }
}

// Вход
async function login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) return alert('Заполните все поля');

    const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (data.success) {
        currentUser = username;
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('chatSection').style.display = 'flex';
        connectWebSocket();
        loadUsers();
    } else {
        document.getElementById('loginError').style.display = 'block';
    }
}

// Выход
function logout() {
    localStorage.removeItem('user');
    socket.close();
    currentUser = null;
    currentChatWith = null;
    document.getElementById('chatSection').style.display = 'none';
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('messages').innerHTML = '';
    document.getElementById('users').innerHTML = '';
}

// WebSocket
function connectWebSocket() {
    socket = new WebSocket('wss://' + window.location.host + '/ws');

    socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'join', username: currentUser }));
    };

    socket.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'message') {
            addMessage(msg.from, msg.text, 'received');
            playNotificationSound();
        } else if (msg.type === 'users') {
            updateUsersList(msg.users);
        } else if (msg.type === 'userJoined') {
            addSystemMessage(`${msg.username} присоединился`);
        } else if (msg.type === 'userLeft') {
            addSystemMessage(`${msg.username} покинул чат`);
        }
    };

    socket.onclose = () => {
        console.log('Соединение закрыто');
    };
}

// Отправить сообщение
function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text || !currentChatWith) return;

    socket.send(JSON.stringify({
        type: 'message',
        to: currentChatWith,
        text: text
    }));

    addMessage(currentUser, text, 'sent');
    input.value = '';
}

// Добавить сообщение
function addMessage(from, text, type) {
    const messages = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.textContent = `${from}: ${text}`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

// Добавить системное сообщение
function addSystemMessage(text) {
    const messages = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = 'message';
    div.style.backgroundColor = '#e0e0e0';
    div.style.textAlign = 'center';
    div.style.fontStyle = 'italic';
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

// Звук уведомления — 2 коротких пика
function playNotificationSound() {
    const audio = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YU9vT18=');
    audio.play().catch(() => {});
    setTimeout(() => audio.play().catch(() => {}), 150);
}

// Поиск пользователей
function searchUsers() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const users = document.getElementById('users');
    const items = users.querySelectorAll('li');

    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(query) ? 'block' : 'none';
    });
}

// Загрузить список пользователей
async function loadUsers() {
    const res = await fetch('/users');
    const users = await res.json();
    updateUsersList(users);
}

function updateUsersList(users) {
    const usersList = document.getElementById('users');
    usersList.innerHTML = '';

    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user;
        if (user === currentUser) li.style.color = '#667eea';
        li.onclick = () => {
            currentChatWith = user;
            document.querySelectorAll('.users-list li').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
        };
        usersList.appendChild(li);
    });
}