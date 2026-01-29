// === УПРОЩЁННЫЕ И РАБОЧИЕ ЗВОНКИ ===

let callData = {
    peerConnection: null,
    localStream: null,
    remoteStream: null,
    isActive: false,
    isIncoming: false,
    caller: null,
    isMicMuted: false,
    isSpeakerMuted: false
};

// Начать звонок
async function startCall() {
    if (!currentChatWith) {
        showChatMessage("Выберите собеседника", "error");
        return;
    }

    if (callData.isActive) {
        endCall();
        return;
    }

    try {
        // Запрашиваем доступ к микрофону
        callData.localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        // Создаём упрощённое WebRTC соединение
        callData.peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" }
            ]
        });

        // Добавляем локальный поток
        callData.localStream.getTracks().forEach(track => {
            callData.peerConnection.addTrack(track, callData.localStream);
        });

        // Обработка входящего аудиопотока
        callData.peerConnection.ontrack = (event) => {
            callData.remoteStream = event.streams[0];
            playRemoteAudio();
            showChatMessage("🔊 Соединение установлено", "success");
        };

        // Создаём и отправляем offer
        const offer = await callData.peerConnection.createOffer();
        await callData.peerConnection.setLocalDescription(offer);

        socket.send(JSON.stringify({
            type: 'callOffer',
            to: currentChatWith,
            from: currentUser,
            offer: offer
        }));

        // Активируем интерфейс звонка
        callData.isActive = true;
        showCallInterface();
        showChatMessage(`📞 Вызываю ${currentChatWith}...`, "info");

    } catch (error) {
        console.error("Ошибка звонка:", error);
        showChatMessage("Ошибка при запуске звонка", "error");
    }
}

// Показать интерфейс звонка
function showCallInterface() {
    document.getElementById('callControls').style.display = 'flex';
    document.getElementById('messageInput').disabled = true;
    document.querySelector('.message-input-container button').disabled = true;
}

// Принять входящий звонок
async function acceptCall() {
    if (!callData.isIncoming || !callData.caller) return;

    try {
        callData.localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        callData.peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" }
            ]
        });

        // Добавляем локальный поток
        callData.localStream.getTracks().forEach(track => {
            callData.peerConnection.addTrack(track, callData.localStream);
        });

        callData.peerConnection.ontrack = (event) => {
            callData.remoteStream = event.streams[0];
            playRemoteAudio();
            showChatMessage("🔊 Соединение установлено", "success");
        };

        // Устанавливаем удалённое описание (offer от звонящего)
        await callData.peerConnection.setRemoteDescription(
            new RTCSessionDescription(callData.pendingOffer)
        );

        // Создаём и отправляем answer
        const answer = await callData.peerConnection.createAnswer();
        await callData.peerConnection.setLocalDescription(answer);

        socket.send(JSON.stringify({
            type: 'callAnswer',
            to: callData.caller,
            from: currentUser,
            answer: answer
        }));

        callData.isActive = true;
        callData.isIncoming = false;
        showCallInterface();
        
        document.getElementById('callNotification').style.display = 'none';
        showChatMessage(`📞 Разговор с ${callData.caller}`, "success");

    } catch (error) {
        console.error("Ошибка принятия звонка:", error);
        showChatMessage("Ошибка при принятии звонка", "error");
    }
}

// Отклонить звонок
function rejectCall() {
    if (!callData.isIncoming || !callData.caller) return;

    socket.send(JSON.stringify({
        type: 'callRejected',
        to: callData.caller,
        from: currentUser
    }));

    callData.isIncoming = false;
    callData.caller = null;
    
    document.getElementById('callNotification').style.display = 'none';
    showChatMessage(`📞 Вы отклонили звонок`, "info");
}

// Завершить звонок
function endCall() {
    if (!callData.isActive) return;

    // Останавливаем все потоки
    if (callData.localStream) {
        callData.localStream.getTracks().forEach(track => track.stop());
    }
    if (callData.remoteStream) {
        callData.remoteStream.getTracks().forEach(track => track.stop());
    }
    if (callData.peerConnection) {
        callData.peerConnection.close();
    }

    // Сбрасываем состояние
    callData = {
        peerConnection: null,
        localStream: null,
        remoteStream: null,
        isActive: false,
        isIncoming: false,
        caller: null,
        isMicMuted: false,
        isSpeakerMuted: false
    };

    // Скрываем интерфейс звонка
    document.getElementById('callControls').style.display = 'none';
    document.getElementById('messageInput').disabled = false;
    document.querySelector('.message-input-container button').disabled = false;

    showChatMessage("📞 Звонок завершён", "success");
}

// Управление микрофоном
function toggleMic() {
    if (!callData.isActive) return;
    callData.isMicMuted = !callData.isMicMuted;

    if (callData.localStream) {
        callData.localStream.getAudioTracks().forEach(track => {
            track.enabled = !callData.isMicMuted;
        });
    }

    const btn = document.getElementById('muteMicBtn');
    btn.classList.toggle('muted');
    btn.textContent = callData.isMicMuted ? "🎙️" : "🔇";
}

// Управление звуком
function toggleSpeaker() {
    if (!callData.isActive) return;
    callData.isSpeakerMuted = !callData.isSpeakerMuted;

    const btn = document.getElementById('muteSpeakerBtn');
    btn.classList.toggle('speaker-muted');
    btn.textContent = callData.isSpeakerMuted ? "🔊" : "🔇";
}

// Воспроизведение звука собеседника
function playRemoteAudio() {
    if (!callData.remoteStream || callData.isSpeakerMuted) return;

    const audio = new Audio();
    audio.srcObject = callData.remoteStream;
    audio.autoplay = true;
    audio.play().catch(e => console.log("Аудио воспроизведение:", e));
}

// Обработка входящего звонка
function handleCallNotification(from, offer) {
    callData.caller = from;
    callData.pendingOffer = offer;
    callData.isIncoming = true;

    showCallNotification(from);
}

// Показать уведомление о звонке
function showCallNotification(from) {
    let notification = document.getElementById('callNotification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'callNotification';
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #667eea;
            color: white;
            padding: 30px;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            z-index: 1000;
            text-align: center;
            min-width: 300px;
        `;
        document.body.appendChild(notification);
    }

    notification.innerHTML = `
        <div style="font-size: 2em; margin-bottom: 10px;">📞</div>
        <h3>${from} звонит вам</h3>
        <div style="display: flex; gap: 15px; margin-top: 20px;">
            <button onclick="acceptCall()" style="flex: 1; padding: 12px; background: #28a745; color: white; border: none; border-radius: 10px; font-size: 16px;">
                Принять
            </button>
            <button onclick="rejectCall()" style="flex: 1; padding: 12px; background: #dc3545; color: white; border: none; border-radius: 10px; font-size: 16px;">
                Отклонить
            </button>
        </div>
    `;

    // Автоотклонение через 30 секунд
    setTimeout(() => {
        if (callData.isIncoming) {
            rejectCall();
        }
    }, 30000);
}
