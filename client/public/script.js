// Глобальные переменные
let currentUser = null;
let socket = null;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    checkSavedSession();
});

// Проверка сохранённой сессии
function checkSavedSession() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = savedUser;
        showChatScreen();
        initializeChat();
    }
}

// Вход в систему
async function login() {
    const usernameInput = document.getElementById('usernameInput');
    const username = usernameInput.value.trim();
    
    if (!username) {
        alert('Пожалуйста, введите имя пользователя');
        return;
    }
    
    if (username.length < 2) {
        alert('Имя должно содержать минимум 2 символа');
        return;
    }
    
    // Простая регистрация/вход - сразу пропускаем
    currentUser = username;
    localStorage.setItem('currentUser', username);
    
    showChatScreen();
    initializeChat();
}

// Выход из системы
function logout() {
    if (socket) {
        socket.close();
    }
    
    localStorage.removeItem('currentUser');
    currentUser = null;
    
    showAuthScreen();
}

// Показать экран авторизации
function showAuthScreen() {
    document.getElementById('authScreen').classList.add('active');
    document.getElementById('chatScreen').classList.remove('active');
}

// Показать экран чата
function showChatScreen() {
    document.getElementById('authScreen').classList.remove('active');
    document.getElementById('chatScreen').classList.add('active');
    document.getElementById('currentUserName').textContent = currentUser;
}

// Инициализация чата (будет в chat.js)
function initializeChat() {
    if (typeof initChat === 'function') {
        initChat(currentUser);
    }
}
