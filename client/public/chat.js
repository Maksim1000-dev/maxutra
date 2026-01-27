// Глобальные переменные чата
let currentChatWith = null;
let messages = {};
let onlineUsers = [];

// Инициализация чата
function initChat(username) {
    connectWebSocket(username);
    setupEventListeners();
}

// Подключение WebSocket
function connectWebSocket(username) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    socket = new WebSocket(wsUrl);
    
    socket.onopen = function() {
        console.log('WebSocket подключен');
        // Регистрируем пользователя на сервере
        socket.send(JSON.stringify({
            type: 'register',
            username: username
        }));
    };
    
    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };
    
    socket.onclose = function() {
        console.log('WebSocket отключен');
        // Попытка переподключения через 3 секунды
        setTimeout(() => connectWebSocket(username), 3000);
    };
    
    socket.onerror = function(error) {
        console.error('WebSocket ошибка:', error);
    };
}

// Обработка сообщений WebSocket
function handleWebSocketMessage(data) {
    switch(data.type) {
        case 'userList':
            updateOnlineUsers(data.users);
            break;
        case 'message':
            receiveMessage(data.from, data.text, data.timestamp);
            break;
        case 'userJoined':
            addSystemMessage(`${data.username} присоединился к чату`);
            updateOnlineUsers(data.users || onlineUsers);
            break;
        case 'userLeft':
            addSystemMessage(`${data.username} покинул чат`);
            updateOnlineUsers(data.users || onlineUsers);
            break;
    }
}

// Обновление списка онлайн-пользователей
function updateOnlineUsers(users) {
    onlineUsers = users.filter(user => user !== currentUser);
    renderUsersList();
}

// Отображение списка пользователей
function renderUsersList() {
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = '';
    
    onlineUsers.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = `user-item ${currentChatWith === user ? 'active' : ''}`;
        userElement.onclick = () => selectUser(user);
        
        userElement.innerHTML = `
            <div class="user-avatar">${user.charAt(0).toUpperCase()}</div>
            <div class="user-info-small">
                <div class="user-name">${user}</div>
                <div class="user-status">online</div>
            </div>
        `;
        
        usersList.appendChild(userElement);
    });
}

// Выбор пользователя для чата
function selectUser(username) {
    if (username === currentUser) return; // Нельзя писать самому себе
    
    currentChatWith = username;
    renderUsersList();
    updateChatHeader();
    loadChatHistory();
    enableMessageInput();
}

// Обновление заголовка чата
function updateChatHeader() {
    const chatWithName = document.getElementById('chatWithName');
    const chatWithInfo = document.getElementById('chatWithInfo');
    
    if (currentChatWith) {
        chatWithName.textContent = currentChatWith;
        chatWithInfo.innerHTML = `
            <div class="chat-avatar">${currentChatWith.charAt(0).toUpperCase()}</div>
            <div>
                <div class="user-name">${currentChatWith}</div>
                <div class="user-status">online</div>
            </div>
        `;
    } else {
        chatWithName.textContent = 'Выберите собеседника';
        chatWithInfo.innerHTML = '<div class="chat-avatar">👥</div>';
    }
}

// Включение поля ввода сообщения
function enableMessageInput() {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.querySelector('.message-input-container button');
    
    messageInput.disabled = false;
    sendButton.disabled = false;
    messageInput.focus();
}

// Отправка сообщения
function sendMessage() {
    if (!currentChatWith) return;
    
    const messageInput = document.getElementById('messageInput');
    const text = messageInput.value.trim();
    
    if (!text) return;
    
    // Отправляем сообщение через WebSocket
    if (socket && socket.readyState === WebSocket.OPEN) {
        const messageData = {
            type: 'message',
            to: currentChatWith,
            text: text,
            timestamp: new Date().toISOString()
        };
        
        socket.send(JSON.stringify(messageData));
        
        // Добавляем сообщение в историю
        addMessageToHistory(currentUser, text, 'sent', new Date().toISOString());
        messageInput.value = '';
        
        // Прокручиваем к последнему сообщению
        scrollToBottom();
    }
}

// Получение сообщения
function receiveMessage(from, text, timestamp) {
    if (from === currentChatWith) {
        // Если сообщение от текущего собеседника, добавляем в чат
        addMessageToHistory(from, text, 'received', timestamp);
        playNotificationSound();
    }
    
    // Сохраняем сообщение в историю
    if (!messages[from]) {
        messages[from] = [];
    }
    messages[from].push({
        text: text,
        timestamp: timestamp,
        type: 'received'
    });
}

// Добавление сообщения в историю
function addMessageToHistory(author, text, messageType, timestamp) {
    if (!messages[author]) {
        messages[author] = [];
    }
    
    messages[author].push({
        text: text,
        timestamp: timestamp,
        type: messageType
    });
    
    // Сохраняем историю в localStorage
    saveChatHistory();
    
    // Отображаем сообщение
    if (author === currentChatWith || (author === currentUser && messageType === 'sent')) {
        displayMessage(author, text, messageType, timestamp);
    }
}

// Отображение сообщения в чате
function displayMessage(author, text, messageType, timestamp) {
    const messagesContainer = document.getElementById('messagesContainer');
    const messageElement = document.createElement('div');
    
    const time = new Date(timestamp).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    messageElement.className = `message ${messageType}`;
    messageElement.innerHTML = `
        <div class="message-text">${text}</div>
        <div class="message-time">${time}</div>
    `;
    
    messagesContainer.appendChild(messageElement);
    scrollToBottom();
}

// Загрузка истории чата
function loadChatHistory() {
    if (!currentChatWith) return;
    
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.innerHTML = '';
    
    const chatHistory = messages[currentChatWith] || [];
    
    chatHistory.forEach(msg => {
        const messageType = msg.type === 'sent' ? 'sent' : 'received';
        displayMessage(currentChatWith, msg.text, messageType, msg.timestamp);
    });
}

// Добавление системного сообщения
function addSystemMessage(text) {
    const messagesContainer = document.getElementById('messagesContainer');
    const systemMessage = document.createElement('div');
    
    systemMessage.className = 'system-message';
    systemMessage.textContent = text;
    systemMessage.style.cssText = `
        text-align: center;
        color: #666;
        font-style: italic;
        margin: 10px 0;
        padding: 5px;
    `;
    
    messagesContainer.appendChild(systemMessage);
    scrollToBottom();
}

// Прокрутка к последнему сообщению
function scrollToBottom() {
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Поиск пользователей
function searchUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const userItems = document.querySelectorAll('.user-item');
    
    userItems.forEach(item => {
        const userName = item.querySelector('.user-name').textContent.toLowerCase();
        if (userName.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Звук уведомления
function playNotificationSound() {
    // Простой бип-бип звук
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
    
    // Второй бип
    setTimeout(() => {
        const oscillator2 = audioContext.createOscillator();
        const gainNode2 = audioContext.createGain();
        
        oscillator2.connect(gainNode2);
        gainNode2.connect(audioContext.destination);
        
        oscillator2.frequency.value = 600;
        oscillator2.type = 'sine';
        
        gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator2.start(audioContext.currentTime);
        oscillator2.stop(audioContext.currentTime + 0.1);
    }, 150);
}

// Сохранение истории чата в localStorage
function saveChatHistory() {
    localStorage.setItem('chatHistory', JSON.stringify(messages));
}

// Загрузка истории чата из localStorage
function loadSavedChatHistory() {
    const savedHistory = localStorage.getItem('chatHistory');
    if (savedHistory) {
        messages = JSON.parse(savedHistory);
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    const messageInput = document.getElementById('messageInput');
    
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Загружаем сохранённую историю при инициализации
    loadSavedChatHistory();
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = savedUser;
        initChat(currentUser);
    }
});
