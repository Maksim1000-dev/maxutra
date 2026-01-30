// call.js — Только аудиозвонки: WebRTC, микрофон, звонок, звук

// Глобальные переменные (используются из script.js: socket, currentUser)
let callPeerConnection = null;
let callLocalStream = null;
let callRemoteStream = null;
let isCallActive = false;
let isCallIncoming = false;
let callFrom = null;
let isMicMuted = false;
let isSpeakerMuted = false;

// 🎯 Один глобальный элемент для воспроизведения звука собеседника
let remoteAudioElement = null;

// === НАЧАТЬ ЗВОНОК ===
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
            if (event.candidate && socket) {
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

        if (socket) {
            socket.send(JSON.stringify({
                type: 'callOffer',
                to: currentChatWith,
                from: currentUser,
                offer: offer
            }));
        }

        isCallActive = true;
        document.getElementById('callControls')?.style.setProperty('display', 'flex');
        document.getElementById('messageInput')?.setAttribute('disabled', 'true');
        document.querySelector('.message-input-container button')?.setAttribute('disabled', 'true');
        showChatMessage(`📞 Вызов ${currentChatWith}...`, 'info');

    } catch (err) {
        console.error("Ошибка доступа к микрофону:", err);
        showChatMessage("Не удалось получить доступ к микрофону", "error");
    }
}

// === ПРИНЯТЬ ЗВОНОК ===
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
        if (event.candidate && socket) {
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
        if (socket) {
            socket.send(JSON.stringify({
                type: 'callAnswer',
                to: callFrom,
                from: currentUser,
                answer: callPeerConnection.localDescription
            }));
        }
    });

    isCallActive = true;
    isCallIncoming = false;
    callFrom = null;

    document.getElementById('callControls')?.style.setProperty('display', 'flex');
    document.getElementById('messageInput')?.setAttribute('disabled', 'true');
    document.querySelector('.message-input-container button')?.setAttribute('disabled', 'true');
    document.getElementById('callNotification')?.style.setProperty('display', 'none');

    showChatMessage(`📞 Вы приняли звонок от ${callFrom}`, 'success');
}

// === ОТКЛОНИТЬ ЗВОНОК ===
function rejectCall() {
    if (!isCallIncoming || !callFrom) return;
    if (socket) {
        socket.send(JSON.stringify({
            type: 'callRejected',
            to: callFrom,
            from: currentUser
        }));
    }
    isCallIncoming = false;
    callFrom = null;
    document.getElementById('callNotification')?.style.setProperty('display', 'none');
    showChatMessage(`📞 Вы отклонили звонок от ${callFrom}`, 'info');
}

// === ОБРАБОТКА УВЕДОМЛЕНИЯ О ЗВОНКЕ ===
function handleCallNotification(from, offer) {
    callFrom = from;
    isCallIncoming = true;

    let notification = document.getElementById('callNotification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'callNotification';
        notification.style.cssText = `
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
            showChatMessage(`📞 Звонок от ${from} истёк`, 'info');
        }
    }, 30000);
}

// === ПРИНЯТЬ ОТВЕТ НА ЗВОНОК ===
function handleCallAccepted(answer) {
    if (!callPeerConnection) return;
    callPeerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    showChatMessage("📞 Звонок установлен!", "success");
}

// === ОБРАБОТКА ICE-КАНДИДАТА ===
function handleCallCandidate(candidate) {
    if (!callPeerConnection) return;
    callPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

// === ЗАВЕРШИТЬ ЗВОНОК ===
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

    document.getElementById('callControls')?.style.setProperty('display', 'none');
    document.getElementById('messageInput')?.removeAttribute('disabled');
    document.querySelector('.message-input-container button')?.removeAttribute('disabled');
    showChatMessage("📞 Звонок завершён", "success");
}

// === ВКЛ/ВЫКЛ МИКРОФОН ===
function toggleMic() {
    if (!isCallActive) return;
    isMicMuted = !isMicMuted;
    if (callLocalStream) {
        callLocalStream.getAudioTracks().forEach(track => {
            track.enabled = !isMicMuted;
        });
    }
    const btn = document.getElementById('muteMicBtn');
    if (btn) {
        btn.classList.toggle('muted');
        btn.title = isMicMuted ? "Включить микрофон" : "Выключить микрофон";
        btn.textContent = isMicMuted ? "🎙️" : "🔇";
    }
}

// === ВКЛ/ВЫКЛ ЗВУК СОБЕСЕДНИКА ===
function toggleSpeaker() {
    if (!isCallActive) return;
    isSpeakerMuted = !isSpeakerMuted;
    const btn = document.getElementById('muteSpeakerBtn');
    if (btn) {
        btn.classList.toggle('speaker-muted');
        btn.title = isSpeakerMuted ? "Включить звук собеседника" : "Отключить звук собеседника";
        btn.textContent = isSpeakerMuted ? "🔊" : "🔇";
    }
}

// === ВОСПРОИЗВЕДЕНИЕ ЗВУКА СОБЕСЕДНИКА ===
function playRemoteAudio() {
    if (!callRemoteStream || isSpeakerMuted) return;
    if (!remoteAudioElement) {
        remoteAudioElement = document.createElement('audio');
        remoteAudioElement.autoplay = true;
        remoteAudioElement.muted = false;
        remoteAudioElement.style.display = 'none';
        document.body.appendChild(remoteAudioElement);
    }
    remoteAudioElement.srcObject = callRemoteStream;
    remoteAudioElement.play().catch(e => console.log("Ошибка воспроизведения звука:", e));
}
