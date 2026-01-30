// chat.js — Логика чата: сообщения, файлы, поиск, история, UI

// Глобальные переменные (используются из script.js: socket, currentUser)
let currentChatWith = null;
let messages = {};
let activeChats = new Set();

// === ИНИЦИАЛИЗАЦИЯ ЧАТА ===
function initChat(username) {
    currentUser = username; // Устанавливаем текущего пользователя
    setupChatEvents();
    loadChatHistory();
    setupFileDragDrop();
}

// === ПОЛУЧЕНИЕ СООБЩЕНИЯ ===
function receiveMessage(from, text, timestamp) {
    if (!activeChats.has(from)) {
        activeChats.add(from);
        renderActiveChats();
    }

    if (!messages[from]) messages[from] = [];
    messages[from].push({ text, timestamp, type: 'received' });

    if (from === currentChatWith) {
        addMessageToHistory(from, text, 'received', timestamp);
        playNotificationSound();
    }
    saveChatHistory();
}

// === ОТПРАВКА СООБЩЕНИЯ ===
function sendMessage() {
    if (!currentChatWith) return;
    const messageInput = document.getElementById('messageInput');
    const text = messageInput.value.trim();
    if (!text) return;

    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'message',
            to: currentChatWith,
            from: currentUser,
            text: text,
            timestamp: new Date().toISOString()
        }));

        addMessageToHistory(currentUser, text, 'sent', new Date().toISOString());
        messageInput.value = '';
        scrollToBottom();
    }
}

// === ДОБАВИТЬ СООБЩЕНИЕ В ИСТОРИЮ ===
function addMessageToHistory(author, text, messageType, timestamp) {
    if (!messages[author]) messages[author] = [];
    messages[author].push({ text, timestamp, type: messageType });
    saveChatHistory();

    if (author === currentChatWith || (author === currentUser && messageType === 'sent')) {
        displayMessage(author, text, messageType, timestamp);
    }
}

// === ОТОБРАЗИТЬ СООБЩЕНИЕ ===
function displayMessage(author, text, messageType, timestamp) {
    const messagesContainer = document.getElementById('messagesContainer');
    const welcomeMessage = messagesContainer.querySelector('.welcome-message');
    if (welcomeMessage) welcomeMessage.remove();

    const messageElement = document.createElement('div');
    const time = new Date(timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    messageElement.className = `message ${messageType}`;
    messageElement.innerHTML = `
        <div class="message-text">${text}</div>
        <div class="message-time">${time}</div>
    `;

    messagesContainer.appendChild(messageElement);
    scrollToBottom();
}

// === ПОЛУЧЕНИЕ ФАЙЛА ===
function receiveFile(from, fileInfo, fileData) {
    if (!activeChats.has(from)) {
        activeChats.add(from);
        renderActiveChats();
    }

    if (!messages[from]) messages[from] = [];
    const fileMessage = {
        text: `[Файл: ${fileInfo.name} (${(fileInfo.size / 1024 / 1024).toFixed(2)} МБ)]`,
        timestamp: new Date().toISOString(),
        type: 'received',
        isFile: true,
        fileInfo: fileInfo,
        fileData: fileData
    };

    messages[from].push(fileMessage);
    saveChatHistory();

    if (from === currentChatWith) {
        displayFileMessage(from, fileInfo, fileData);
        playNotificationSound();
    }
}

// === ОТОБРАЗИТЬ ФАЙЛ ===
function displayFileMessage(from, fileInfo, fileData) {
    const messagesContainer = document.getElementById('messagesContainer');
    const welcomeMessage = messagesContainer.querySelector('.welcome-message');
    if (welcomeMessage) welcomeMessage.remove();

    const messageElement = document.createElement('div');
    const time = new Date().toISOString().split('T')[1].split('.')[0].substring(0, 5);

    messageElement.className = 'message received file';
    messageElement.innerHTML = `
        <div class="file-icon">📎</div>
        <div class="file-name">${fileInfo.name}</div>
        <div class="file-size">${(fileInfo.size / 1024 / 1024).toFixed(2)} МБ</div>
        <div class="message-time">${time}</div>
    `;

    messageElement.onclick = () => {
        const a = document.createElement('a');
        a.href = fileData;
        a.download = fileInfo.name;
        a.click();
    };

    messagesContainer.appendChild(messageElement);
    scrollToBottom();
}

// === ОБРАБОТКА ЗАГРУЗКИ ФАЙЛА ===
function handleFileUpload(file) {
    if (!currentChatWith) {
        showChatMessage('Выберите собеседника для отправки файла', 'error');
        return;
    }

    if (file.size > 300 * 1024 * 1024) {
        showChatMessage(`Файл слишком большой. Максимум: 300 МБ`, 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const fileData = e.target.result;
        const fileInfo = {
            name: file.name,
            size: file.size,
            type: file.type
        };

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'file',
                to: currentChatWith,
                from: currentUser,
                fileInfo: fileInfo,
                fileData: fileData
            }));

            addMessageToHistory(currentUser, `[Файл: ${file.name}]`, 'sent', new Date().toISOString());
        }
    };
    reader.readAsDataURL(file);
}

// === НАСТРОЙКА ПЕРЕТАСКИВАНИЯ ФАЙЛОВ ===
function setupFileDragDrop() {
    const messagesContainer = document.getElementById('messagesContainer');
    const dropZone = document.getElementById('dropZone');

    messagesContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.display = 'flex';
    });

    messagesContainer.addEventListener('dragleave', (e) => {
        if (e.target === messagesContainer) {
            dropZone.style.display = 'none';
        }
    });

    dropZone.addEventListener('dragover', (e) => e.preventDefault());
    dropZone.addEventListener('drop', handleFileDrop);
    messagesContainer.addEventListener('drop', handleFileDrop);
}

function handleFileDrop(e) {
    e.preventDefault();
    const dropZone = document.getElementById('dropZone');
    if (dropZone) dropZone.style.display = 'none';

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileUpload(files[0]);
    }
}

// === ПОИСК ПОЛЬЗОВАТЕЛЯ ===
function searchUser() {
    const searchInput = document.getElementById('userSearch');
    const username = searchInput.value.trim();

    if (!username) {
        showChatMessage('Введите никнейм для поиска', 'error');
        return;
    }

    if (username === currentUser) {
        showChatMessage('Нельзя писать самому себе', 'error');
        return;
    }

    try {
        fetch('/search-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, searcher: currentUser })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                displaySearchResult(data.user);
            } else {
                showChatMessage(data.message, 'error');
            }
        })
        .catch(() => {
            showChatMessage('Ошибка поиска пользователя', 'error');
        });
    } catch (error) {
        showChatMessage('Ошибка поиска пользователя', 'error');
    }
}

// === ОТОБРАЗИТЬ РЕЗУЛЬТАТ ПОИСКА ===
function displaySearchResult(user) {
    const searchResults = document.getElementById('searchResults');
    if (!searchResults) return;

    if (!user) {
        searchResults.innerHTML = '<div class="search-result-item">Пользователь не найден</div>';
        return;
    }

    searchResults.innerHTML = `
        <div class="search-result-item" onclick="startChatWith('${user.username}')">
            <div class="search-result-avatar">${user.username.charAt(0).toUpperCase()}</div>
            <div>
                <div class="chat-item-name">${user.username}</div>
                <div class="chat-item-status">${user.online ? 'online' : 'offline'}</div>
            </div>
            <button class="start-chat-btn">💬</button>
        </div>
    `;
}

// === НАЧАТЬ ЧАТ С ПОЛЬЗОВАТЕЛЕМ ===
function startChatWith(username) {
    if (username === currentUser) return;

    currentChatWith = username;
    activeChats.add(username);
    updateChatHeader();
    loadChatHistory();
    enableMessageInput();
    renderActiveChats();

    // Отобразить историю чата
    if (messages[username]) {
        messages[username].forEach(msg => {
            displayMessage(username, msg.text, msg.type, msg.timestamp);
        });
    }

    document.getElementById('searchResults')?.innerHTML = '';
    document.getElementById('userSearch')?.value = '';
}

// === ОБНОВИТЬ ЗАГОЛОВОК ЧАТА ===
function updateChatHeader() {
    const chatWithName = document.getElementById('chatWithName');
    const chatWithInfo = document.getElementById('chatWithInfo');

    if (!chatWithName || !chatWithInfo) return;

    if (currentChatWith) {
        chatWithName.textContent = currentChatWith;
        chatWithInfo.innerHTML = `
            <div class="chat-avatar">${currentChatWith.charAt(0).toUpperCase()}</div>
            <div>
                <div class="user-name">${currentChatWith}</div>
                <div class="chat-status">online</div>
            </div>
        `;
    } else {
        chatWithName.textContent = 'Выберите собеседника';
        chatWithInfo.innerHTML = '<div class="chat-avatar">👥</div>';
    }
}

// === ВКЛЮЧИТЬ ПОЛЕ ВВОДА ===
function enableMessageInput() {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.querySelector('.message-input-container button');
    if (messageInput) messageInput.disabled = false;
    if (sendButton) sendButton.disabled = false;
    messageInput?.focus();
}

// === ОТОБРАЗИТЬ АКТИВНЫЕ ЧАТЫ ===
function renderActiveChats() {
    const activeChatsContainer = document.getElementById('activeChats');
    if (!activeChatsContainer) return;

    activeChatsContainer.innerHTML = '';
    activeChats.forEach(username => {
        if (username === currentUser) return;

        const chatItem = document.createElement('div');
        chatItem.className = `chat-item ${currentChatWith === username ? 'active' : ''}`;
        chatItem.onclick = () => selectChat(username);

        const lastMessage = messages[username] ? messages[username][messages[username].length - 1] : null;

        chatItem.innerHTML = `
            <div class="chat-item-avatar">${username.charAt(0).toUpperCase()}</div>
            <div class="chat-item-info">
                <div class="chat-item-name">${username}</div>
                <div class="chat-item-status">${lastMessage ? lastMessage.text.substring(0, 20) + '...' : 'Нет сообщений'}</div>
            </div>
        `;

        activeChatsContainer.appendChild(chatItem);
    });
}

// === ВЫБОР ЧАТА ===
function selectChat(username) {
    currentChatWith = username;
    updateChatHeader();
    loadChatHistory();
    enableMessageInput();
    renderActiveChats();

    // Отобразить историю чата
    if (messages[username]) {
        messages[username].forEach(msg => {
            displayMessage(username, msg.text, msg.type, msg.timestamp);
        });
    }

    document.getElementById('searchResults')?.innerHTML = '';
    document.getElementById('userSearch')?.value = '';
}

// === ПРОКРУТКА К ПОСЛЕДНЕМУ СООБЩЕНИЮ ===
function scrollToBottom() {
    const messagesContainer = document.getElementById('messagesContainer');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// === ЗАГРУЗКА ИСТОРИИ ЧАТА ===
function loadChatHistory() {
    const savedData = localStorage.getItem('chatHistory');
    if (savedData) {
        const data = JSON.parse(savedData);
        messages = data.messages || {};
        activeChats = new Set(data.activeChats || []);
    }
}

// === СОХРАНЕНИЕ ИСТОРИИ ЧАТА ===
function saveChatHistory() {
    const chatData = {
        messages: messages,
        activeChats: Array.from(activeChats)
    };
    localStorage.setItem('chatHistory', JSON.stringify(chatData));
}

// === ПОКАЗ СООБЩЕНИЯ ===
function showChatMessage(message, type) {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;

    const messageElement = document.createElement('div');
    messageElement.className = `system-message ${type}`;
    messageElement.textContent = message;
    messageElement.style.cssText = `
        text-align: center;
        color: ${type === 'error' ? '#dc3545' : '#28a745'};
        background: ${type === 'error' ? '#f8d7da' : '#d4edda'};
        padding: 10px;
        margin: 10px 0;
        border-radius: 6px;
        font-size: 0.9em;
    `;
    messagesContainer.appendChild(messageElement);
    scrollToBottom();
    setTimeout(() => messageElement.remove(), 3000);
}

// === ДОБАВИТЬ СИСТЕМНОЕ СООБЩЕНИЕ ===
function addSystemMessage(text) {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;

    const systemMessage = document.createElement('div');
    systemMessage.className = 'system-message';
    systemMessage.textContent = text;
    systemMessage.style.cssText = `
        text-align: center;
        color: #666;
        font-style: italic;
        margin: 10px 0;
        padding: 5px;
        background: #f0f0f0;
        border-radius: 6px;
    `;
    messagesContainer.appendChild(systemMessage);
    scrollToBottom();
}

// === ЗВУК УВЕДОМЛЕНИЯ ===
function playNotificationSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    function playBeep(frequency, duration) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    }
    playBeep(800, 0.1);
    setTimeout(() => playBeep(600, 0.1), 150);
}

// === НАСТРОЙКА СОБЫТИЙ ЧАТА ===
function setupChatEvents() {
    const messageInput = document.getElementById('messageInput');
    const userSearch = document.getElementById('userSearch');

    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    if (userSearch) {
        userSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchUser();
        });
    }

    // Добавляем кнопку звонка (определяется в call.js)
    const chatHeader = document.querySelector('.chat-header');
    if (chatHeader) {
        const callBtn = document.createElement('button');
        callBtn.innerHTML = '📞';
        callBtn.className = 'call-button';
        callBtn.style = `
            background: none;
            border: none;
            font-size: 1.8em;
            cursor: pointer;
            margin-left: 10px;
            color: #667eea;
        `;
        callBtn.title = "Начать аудиозвонок";
        callBtn.onclick = startCall; // Определяется в call.js
        chatHeader.appendChild(callBtn);
    }
}
