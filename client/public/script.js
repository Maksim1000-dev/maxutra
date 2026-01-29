let currentUser = null;
let socket = null; // ✅ ЭТО ОСТАЁТСЯ — ИСПОЛЬЗУЕТСЯ В chat.js
let authState = 'username';

document.addEventListener('DOMContentLoaded', function() {
    checkSavedSession();
    setupAuthEvents();
});

function checkSavedSession() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = savedUser;
        showChatScreen();
        initializeChat();
    }
}

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
            showPasswordField('login');
            showAuthMessage('Пользователь найден. Введите пароль.', 'success');
        } else {
            showPasswordField('register');
            showAuthMessage('Новый пользователь. Придумайте пароль.', 'success');
        }
        
    } catch (error) {
        showAuthMessage('Ошибка соединения с сервером', 'error');
        console.error('Ошибка проверки пользователя:', error);
    }
}

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

function logout() {
    if (socket) {
        socket.close();
    }
    
    localStorage.removeItem('currentUser');
    localStorage.removeItem('chatHistory');
    currentUser = null;
    
    resetAuthForm();
    showAuthScreen();
}

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

function showAuthScreen() {
    document.getElementById('authScreen').classList.add('active');
    document.getElementById('chatScreen').classList.remove('active');
}

function showChatScreen() {
    document.getElementById('authScreen').classList.remove('active');
    document.getElementById('chatScreen').classList.add('active');
    document.getElementById('currentUserName').textContent = currentUser;
    hideAuthMessage();
}

function showAuthMessage(message, type) {
    const authMessage = document.getElementById('authMessage');
    authMessage.textContent = message;
    authMessage.className = `auth-message ${type}`;
    authMessage.style.display = 'block';
}

function hideAuthMessage() {
    const authMessage = document.getElementById('authMessage');
    authMessage.style.display = 'none';
}

function initializeChat() {
    if (typeof initChat === 'function') {
        initChat(currentUser);
    }
}

