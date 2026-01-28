// Глобальные переменные
let currentUser = null;
let socket = null;
let authState = 'username'; // username → password → confirm

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    checkSavedSession();
    setupAuthEvents();
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

// Настройка событий авторизации
function setupAuthEvents() {
    const usernameInput = document.getElementById('usernameInput');
    const passwordInput = document.getElementById('passwordInput');
    const confirmPasswordInput = document.getElementById('confirmPasswordInput');
    
    usernameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            if (authState === 'username') {
                checkUsername();
            }
        }
    });
    
    passwordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleAuth();
        }
    });
    
    confirmPasswordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleAuth();
        }
    });
}

// 🔥 ВАЖНО: ДОБАВЛЯЕМ ФУНКЦИЮ checkUsername()
async function checkUsername() {
    const usernameInput = document.getElementById('usernameInput');
    const username = usernameInput.value.trim();
    
    if (!username) {
        showAuthMessage('Пожалуйста, введите имя пользователя', 'error');
        return;
    }
    
    if (username.length < 2) {
        showAuthMessage('Имя должно содержать минимум 2 символа', 'error');
        return;
    }
    
    // Проверяем существование пользователя на сервере
    try {
        const response = await fetch('/check-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: username })
        });
        
        const data = await response.json();
        
        if (data.exists) {
            // Пользователь существует - показываем поле для пароля
            showPasswordField('login');
            showAuthMessage('Пользователь найден. Введите пароль.', 'success');
        } else {
            // Пользователь не существует - показываем поля для регистрации
            showPasswordField('register');
            showAuthMessage('Новый пользователь. Придумайте пароль.', 'success');
        }
        
    } catch (error) {
        showAuthMessage('Ошибка соединения с сервером', 'error');
        console.error('Ошибка проверки пользователя:', error);
    }
}

// Показ полей для пароля
function showPasswordField(mode) {
    const passwordGroup = document.getElementById('passwordGroup');
    const passwordInput = document.getElementById('passwordInput');
    const confirmPasswordInput = document.getElementById('confirmPasswordInput');
    const startBtn = document.getElementById('startBtn');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    
    passwordGroup.style.display = 'block';
    passwordInput.value = '';
    
    if (mode === 'login') {
        confirmPasswordInput.style.display = 'none';
        startBtn.style.display = 'none';
        loginBtn.style.display = 'block';
        registerBtn.style.display = 'none';
        authState = 'password';
    } else {
        confirmPasswordInput.style.display = 'block';
        confirmPasswordInput.value = '';
        startBtn.style.display = 'none';
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'block';
        authState = 'confirm';
    }
    
    passwordInput.focus();
}

// Обработка авторизации/регистрации
async function handleAuth() {
    const username = document.getElementById('usernameInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    const confirmPassword = document.getElementById('confirmPasswordInput').value;
    
    if (!password) {
        showAuthMessage('Введите пароль', 'error');
        return;
    }
    
    if (authState === 'confirm' && password !== confirmPassword) {
        showAuthMessage('Пароли не совпадают', 'error');
        return;
    }
    
    try {
        const endpoint = authState === 'password' ? '/login' : '/register';
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Успешная авторизация/регистрация
            currentUser = username;
            localStorage.setItem('currentUser', username);
            showChatScreen();
            initializeChat();
        } else {
            showAuthMessage(data.message || 'Ошибка авторизации', 'error');
        }
        
    } catch (error) {
        showAuthMessage('Ошибка соединения с сервером', 'error');
        console.error('Ошибка авторизации:', error);
    }
}

// Выход из системы
function logout() {
    if (socket) {
        socket.close();
    }
    
    localStorage.removeItem('currentUser');
    localStorage.removeItem('chatHistory');
    currentUser = null;
    
    // Сброс формы авторизации
    resetAuthForm();
    showAuthScreen();
}

// Сброс формы авторизации
function resetAuthForm() {
    document.getElementById('usernameInput').value = '';
    document.getElementById('passwordInput').value = '';
    document.getElementById('confirmPasswordInput').value = '';
    document.getElementById('passwordGroup').style.display = 'none';
    
    document.getElementById('startBtn').style.display = 'block';
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('registerBtn').style.display = 'none';
    
    authState = 'username';
    hideAuthMessage();
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
    hideAuthMessage();
}

// Показать сообщение авторизации
function showAuthMessage(message, type) {
    const authMessage = document.getElementById('authMessage');
    authMessage.textContent = message;
    authMessage.className = `auth-message ${type}`;
    authMessage.style.display = 'block';
}

// Скрыть сообщение авторизации
function hideAuthMessage() {
    const authMessage = document.getElementById('authMessage');
    authMessage.style.display = 'none';
}

// Инициализация чата
function initializeChat() {
    if (typeof initChat === 'function') {
        initChat(currentUser);
    }
}
