// Глобальные переменные чата
let currentChatWith = null;
let messages = {};
let activeChats = new Set();

// === АУДИОЗВОНОК ===
let callPeerConnection = null;
let callLocalStream = null;
let callRemoteStream = null;
let isCallActive = false;
let isCallIncoming = false;
let callFrom = null;
let isMicMuted = false;
let isSpeakerMuted = false;

// === ФАЙЛЫ ===
const MAX_FILE_SIZE = 300 * 1024 * 1024; // 300 МБ

// Инициализация чата
function initChat(username) {
    connectWebSocket(username);
    setupChatEvents();
    loadChatHistory();
    setupFileDragDrop();
}

// Подключение WebSocket
function connectWebSocket(username) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    socket = new WebSocket(wsUrl);

    socket.onopen = function() {
        console.log('WebSocket подключен');
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
            break;
        case 'userLeft':
            addSystemMessage(`${data.username} покинул чат`);
            break;
        case 'callNotification':
            handleCallNotification(data.from, data.offer);
            break;
        case 'callAccepted':
            handleCallAccepted(data.answer);
            break;
        case 'callCandidate':
            handleCallCandidate(data.candidate);
            break;
        case 'callRejected':
            showChatMessage(`📞 ${data.from} отклонил ваш вызов`, "info");
            endCall();
            break;
        case 'file':
            receiveFile(data.from, data.fileInfo, data.fileData);
            break;
    }
}

// === НЕДОСТАЮЩАЯ ФУНКЦИЯ: ОБНОВЛЕНИЕ ОНЛАЙН-ПОЛЬЗОВАТЕЛЕЙ ===
function updateOnlineUsers(users) {
    // Просто обновляем статус — в реальном проекте можно добавить индикаторы
    console.log('Онлайн пользователи:', users);
    renderActiveChats();
}

// === НЕДОСТАЮЩАЯ ФУНКЦИЯ: СООБЩЕНИЕ В ЧАТ ===
function showChatMessage(message, type) {
    const messagesContainer = document.getElementById('messagesContainer');
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

// === НЕДОСТАЮЩАЯ ФУНКЦИЯ: СИСТЕМНЫЕ СООБЩЕНИЯ ===
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
        background: #f0f0f0;
        border-radius: 6px;
    `;

    messagesContainer.appendChild(systemMessage);
    scrollToBottom();
}

// Обработка уведомления о звонке
function handleCallNotification(from, offer) {
    callFrom = from;
    isCallIncoming = true;

    let notification = document.getElementById('callNotification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'callNotification';
        notification.style = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #667eea;
            color: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 300px;
            font-family: 'Segoe UI', sans-serif;
        `;
        document.body.appendChild(notification);
    }

    notification.innerHTML = `
        <strong>🔔 ${from} звонит...</strong>
        <div style="display: flex; gap: 10px;">
            <button onclick="acceptCall()" style="flex: 1; padding: 10px; background: #28a745; color: white; border: none; border-radius: 6px; font-weight: 600;">Принять</button>
            <button onclick="rejectCall()" style="flex: 1; padding: 10px; background: #dc3545; color: white; border: none; border-radius: 6px; font-weight: 600;">Отклонить</button>
        </div>
    `;

    notification.style.display = 'block';

    setTimeout(() => {
        if (isCallIncoming) {
            notification.style.display = 'none';
            isCallIncoming = false;
            callFrom = null;
            showChatMessage(`📞 Звонок от ${from} истёк`, "info");
        }
    }, 30000);
}

// Принять звонок
function acceptCall() {
    if (!isCallIncoming || !callFrom) return;

    callPeerConnection = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" }
        ]
    });

    callPeerConnection.ontrack = (event) => {
        callRemoteStream = event.streams[0];
        playRemoteAudio();
    };

    callPeerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.send(JSON.stringify({
                type: 'callCandidate',
                to: callFrom,
                from: currentUser,
                candidate: event.candidate
            }));
        }
    };

    callPeerConnection.createAnswer().then(answer => {
        return callPeerConnection.setLocalDescription(answer);
    }).then(() => {
        socket.send(JSON.stringify({
            type: 'callAnswer',
            to: callFrom,
            from: currentUser,
            answer: callPeerConnection.localDescription
        }));
    });

    isCallActive = true;
    isCallIncoming = false;
    callFrom = null;

    document.getElementById('callControls').style.display = 'flex';
    document.getElementById('messageInput').disabled = true;
    document.querySelector('.message-input-container button').disabled = true;

    document.getElementById('callNotification').style.display = 'none';

    showChatMessage(`📞 Вы приняли звонок от ${callFrom}`, "success");
}

// Отклонить звонок
function rejectCall() {
    if (!isCallIncoming || !callFrom) return;

    socket.send(JSON.stringify({
        type: 'callRejected',
        to: callFrom,
        from: currentUser
    }));

    isCallIncoming = false;
    callFrom = null;

    document.getElementById('callNotification').style.display = 'none';
    showChatMessage(`📞 Вы отклонили звонок от ${callFrom}`, "info");
}

// Начать звонок
async function startCall() {
    if (!currentChatWith) {
        showChatMessage("Выберите собеседника", "error");
        return;
    }

    if (isCallActive) {
        endCall();
        return;
    }

    try {
        callLocalStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        callPeerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" }
            ]
        });

        callLocalStream.getTracks().forEach(track => callPeerConnection.addTrack(track, callLocalStream));

        callPeerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.send(JSON.stringify({
                    type: 'callCandidate',
                    to: currentChatWith,
                    from: currentUser,
                    candidate: event.candidate
                }));
            }
        };

        callPeerConnection.ontrack = (event) => {
            callRemoteStream = event.streams[0];
            playRemoteAudio();
        };

        const offer = await callPeerConnection.createOffer();
        await callPeerConnection.setLocalDescription(offer);

        socket.send(JSON.stringify({
            type: 'callOffer',
            to: currentChatWith,
            from: currentUser,
            offer: offer
        }));

        isCallActive = true;
        document.getElementById('callControls').style.display = 'flex';
        document.getElementById('messageInput').disabled = true;
        document.querySelector('.message-input-container button').disabled = true;

        showChatMessage(`📞 Вызов ${currentChatWith}...`, "info");

    } catch (err) {
        console.error("Ошибка доступа к микрофону:", err);
        showChatMessage("Не удалось получить доступ к микрофону", "error");
    }
}

// Принять ответ на звонок
function handleCallAccepted(answer) {
    if (!callPeerConnection) return;

    callPeerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    showChatMessage("📞 Звонок установлен!", "success");
}

// Обработать ICE-кандидата
function handleCallCandidate(candidate) {
    if (!callPeerConnection) return;

    callPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

// Завершить звонок
function endCall() {
    if (!isCallActive) return;

    if (callPeerConnection) {
        callPeerConnection.close();
        callPeerConnection = null;
    }

    if (callLocalStream) {
        callLocalStream.getTracks().forEach(track => track.stop());
        callLocalStream = null;
    }

    if (callRemoteStream) {
        callRemoteStream.getTracks().forEach(track => track.stop());
        callRemoteStream = null;
    }

    isCallActive = false;
    isCallIncoming = false;
    callFrom = null;

    document.getElementById('callControls').style.display = 'none';
    document.getElementById('messageInput').disabled = false;
    document.querySelector('.message-input-container button').disabled = false;

    showChatMessage("📞 Звонок завершён", "success");
}

// Выключить микрофон
function toggleMic() {
    if (!isCallActive) return;
    isMicMuted = !isMicMuted;

    if (callLocalStream) {
        callLocalStream.getAudioTracks().forEach(track => {
            track.enabled = !isMicMuted;
        });
    }

    const btn = document.getElementById('muteMicBtn');
    btn.classList.toggle('muted');
    btn.title = isMicMuted ? "Включить микрофон" : "Выключить микрофон";
    btn.textContent = isMicMuted ? "🎙️" : "🔇";
}

// Отключить звук собеседника
function toggleSpeaker() {
    if (!isCallActive) return;
    isSpeakerMuted = !isSpeakerMuted;

    const btn = document.getElementById('muteSpeakerBtn');
    btn.classList.toggle('speaker-muted');
    btn.title = isSpeakerMuted ? "Включить звук собеседника" : "Отключить звук собеседника";
    btn.textContent = isSpeakerMuted ? "🔊" : "🔇";
}

// Воспроизведение звука собеседника
function playRemoteAudio() {
    if (!callRemoteStream || isSpeakerMuted) return;

    const audio = document.createElement('audio');
    audio.srcObject = callRemoteStream;
    audio.autoplay = true;
    audio.muted = false;
    audio.play().catch(e => console.log("Ошибка воспроизведения звука:", e));
}

// === ФАЙЛЫ: Настройка перетаскивания ===

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

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.display = 'none';

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });

    messagesContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.display = 'none';

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });
}

// Обработка загрузки файла
function handleFileUpload(file) {
    if (!currentChatWith) {
        showChatMessage('Выберите собеседника для отправки файла', 'error');
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        showChatMessage(`Файл слишком большой. Максимум: ${MAX_FILE_SIZE / 1024 / 1024} МБ`, 'error');
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

// Получение файла
function receiveFile(from, fileInfo, fileData) {
    // АВТОМАТИЧЕСКОЕ СОЗДАНИЕ ЧАТА
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

// Отображение сообщения с файлом
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

// Звук уведомления
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

// Отправка сообщения
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

// Получение сообщения
function receiveMessage(from, text, timestamp) {
    // АВТОМАТИЧЕСКОЕ СОЗДАНИЕ ЧАТА
    if (!activeChats.has(from)) {
        activeChats.add(from);
        renderActiveChats();
    }

    if (!messages[from]) {
        messages[from] = [];
    }

    messages[from].push({ text, timestamp, type: 'received' });

    if (from === currentChatWith) {
        addMessageToHistory(from, text, 'received', timestamp);
        playNotificationSound();
    }

    saveChatHistory();
}

// Добавление сообщения в историю
function addMessageToHistory(author, text, messageType, timestamp) {
    if (!messages[author]) {
        messages[author] = [];
    }

    messages[author].push({ text, timestamp, type: messageType });
    saveChatHistory();

    if (author === currentChatWith || (author === currentUser && messageType === 'sent')) {
        displayMessage(author, text, messageType, timestamp);
    }
}

// Отображение сообщения
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

// Загрузка истории чата
function loadChatHistory() {
    const savedData = localStorage.getItem('chatHistory');
    if (savedData) {
        const data = JSON.parse(savedData);
        messages = data.messages || {};
        activeChats = new Set(data.activeChats || []);
        renderActiveChats();
    }
}

// Сохранение истории чата
function saveChatHistory() {
    const chatData = {
        messages: messages,
        activeChats: Array.from(activeChats)
    };
    localStorage.setItem('chatHistory', JSON.stringify(chatData));
}

// Поиск пользователя
async function searchUser() {
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
        const response = await fetch('/search-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, searcher: currentUser })
        });

        const data = await response.json();

        if (data.success) {
            displaySearchResult(data.user);
        } else {
            showChatMessage(data.message, 'error');
        }
    } catch (error) {
        showChatMessage('Ошибка поиска пользователя', 'error');
    }
}

// Отображение результата поиска
function displaySearchResult(user) {
    const searchResults = document.getElementById('searchResults');
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

// Начать чат с пользователем
function startChatWith(username) {
    if (username === currentUser) return;

    currentChatWith = username;
    activeChats.add(username);
    updateChatHeader();
    loadChatHistory();
    enableMessageInput();
    renderActiveChats();

    document.getElementById('searchResults').innerHTML = '';
    document.getElementById('userSearch').value = '';
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
                <div class="chat-status">${isCallActive ? 'в звонке' : 'online'}</div>
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

// Отображение активных чатов
function renderActiveChats() {
    const activeChatsContainer = document.getElementById('activeChats');
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

// Выбор чата
function selectChat(username) {
    currentChatWith = username;
    updateChatHeader();
    loadChatHistory();
    enableMessageInput();
    renderActiveChats();
}

// Прокрутка к последнему сообщению
function scrollToBottom() {
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// === НЕДОСТАЮЩАЯ ФУНКЦИЯ: Настройка событий чата ===
function setupChatEvents() {
    const messageInput = document.getElementById('messageInput');
    const userSearch = document.getElementById('userSearch');

    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    userSearch.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchUser();
        }
    });

    // Добавляем кнопку звонка в заголовок чата
    const chatHeader = document.querySelector('.chat-header');
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
    callBtn.onclick = startCall;

    chatHeader.appendChild(callBtn);

    loadChatHistory();
}
