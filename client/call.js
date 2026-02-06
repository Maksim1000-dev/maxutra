// Maxutra Call Manager
// Полная логика звонков с двусторонним аудио

const CallManager = {
    // Состояние звонка
    currentCall: null,
    peerConnection: null,
    localStream: null,
    remoteStream: null,
    callStartTime: null,
    callTimerInterval: null,
    isMuted: false,
    isVideoOff: false,
    hasCamera: true,
    
    // ICE серверы для WebRTC
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
    ],
    
    // Начать исходящий звонок
    async startCall(type, targetUserId, targetUserName) {
        console.log('[Call] Начинаем звонок:', type, 'для', targetUserName);
        
        // Проверяем устройства
        const devices = await PermissionsManager.getAvailableDevices();
        
        if (!devices.hasMicrophone) {
            this.showError('Микрофон не найден!');
            return false;
        }
        
        if (type === 'video' && !devices.hasCamera) {
            console.log('[Call] Камера не найдена, переключаемся на аудио-режим');
            this.hasCamera = false;
        } else {
            this.hasCamera = true;
        }
        
        // Получаем медиа поток
        const mediaResult = await PermissionsManager.getMediaStream({
            audio: true,
            video: type === 'video' && this.hasCamera
        });
        
        if (!mediaResult.success) {
            this.showError(mediaResult.error);
            return false;
        }
        
        this.localStream = mediaResult.stream;
        
        if (mediaResult.videoFailed) {
            this.hasCamera = false;
            console.log('[Call] Видео недоступно, продолжаем с аудио');
        }
        
        // Генерируем ID звонка
        const callId = 'call_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        this.currentCall = {
            id: callId,
            type: type,
            isInitiator: true,
            targetUserId: targetUserId,
            targetUserName: targetUserName,
            status: 'calling'
        };
        
        // Отправляем запрос на звонок через WebSocket
        if (window.ws && window.ws.readyState === 1) {
            window.ws.send(JSON.stringify({
                type: 'call_request',
                callId: callId,
                callerId: window.currentUser.id,
                receiverId: targetUserId,
                callerName: window.currentUser.displayName || window.currentUser.username,
                callType: type
            }));
        }
        
        // Показываем UI звонка
        this.showCallUI(type, targetUserName, true);
        
        return true;
    },
    
    // Принять входящий звонок
    async acceptCall(callData) {
        console.log('[Call] Принимаем звонок:', callData);
        
        const type = callData.callType || 'audio';
        
        // Проверяем устройства
        const devices = await PermissionsManager.getAvailableDevices();
        
        if (!devices.hasMicrophone) {
            this.showError('Микрофон не найден!');
            this.rejectCall(callData.callId);
            return;
        }
        
        this.hasCamera = type === 'video' && devices.hasCamera;
        
        // Получаем медиа поток
        const mediaResult = await PermissionsManager.getMediaStream({
            audio: true,
            video: type === 'video' && this.hasCamera
        });
        
        if (!mediaResult.success) {
            this.showError(mediaResult.error);
            this.rejectCall(callData.callId);
            return;
        }
        
        this.localStream = mediaResult.stream;
        
        if (mediaResult.videoFailed) {
            this.hasCamera = false;
        }
        
        this.currentCall = {
            id: callData.callId,
            type: type,
            isInitiator: false,
            callerId: callData.callerId,
            callerName: callData.callerName,
            status: 'connecting'
        };
        
        // Отправляем подтверждение
        if (window.ws && window.ws.readyState === 1) {
            window.ws.send(JSON.stringify({
                type: 'call_accept',
                callId: callData.callId
            }));
        }
        
        // Показываем UI
        this.showCallUI(type, callData.callerName, false);
        
        // Создаём WebRTC соединение
        await this.createPeerConnection(false);
    },
    
    // Отклонить звонок
    rejectCall(callId) {
        console.log('[Call] Отклоняем звонок:', callId);
        
        if (window.ws && window.ws.readyState === 1) {
            window.ws.send(JSON.stringify({
                type: 'call_reject',
                callId: callId || (this.currentCall ? this.currentCall.id : null)
            }));
        }
        
        this.cleanup();
    },
    
    // Завершить звонок
    endCall() {
        console.log('[Call] Завершаем звонок');
        
        if (this.currentCall && window.ws && window.ws.readyState === 1) {
            window.ws.send(JSON.stringify({
                type: 'call_end',
                callId: this.currentCall.id
            }));
        }
        
        this.cleanup();
    },
    
    // Создать WebRTC соединение
    async createPeerConnection(isInitiator) {
        console.log('[Call] Создаём PeerConnection, инициатор:', isInitiator);
        
        // Создаём соединение
        this.peerConnection = new RTCPeerConnection({
            iceServers: this.iceServers
        });
        
        // Добавляем локальные треки
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                console.log('[Call] Добавляем локальный трек:', track.kind);
                this.peerConnection.addTrack(track, this.localStream);
            });
        }
        
        // Обработка удалённых треков - ВАЖНО для слышимости!
        this.peerConnection.ontrack = (event) => {
            console.log('[Call] Получен удалённый трек:', event.track.kind);
            
            if (!this.remoteStream) {
                this.remoteStream = new MediaStream();
            }
            
            this.remoteStream.addTrack(event.track);
            
            // Подключаем удалённое аудио/видео
            const remoteVideo = document.getElementById('remoteVideo');
            const remoteAudio = document.getElementById('remoteAudio');
            
            if (event.track.kind === 'video' && remoteVideo) {
                remoteVideo.srcObject = this.remoteStream;
                remoteVideo.play().catch(e => console.log('[Call] Autoplay видео:', e));
            }
            
            if (event.track.kind === 'audio') {
                // Для аудио создаём отдельный элемент если нужно
                if (remoteAudio) {
                    remoteAudio.srcObject = this.remoteStream;
                    remoteAudio.play().catch(e => console.log('[Call] Autoplay аудио:', e));
                } else if (remoteVideo) {
                    // Используем video элемент для аудио тоже
                    remoteVideo.srcObject = this.remoteStream;
                    remoteVideo.play().catch(e => console.log('[Call] Autoplay:', e));
                }
            }
            
            // Обновляем статус
            this.updateCallStatus('На связи');
            this.startCallTimer();
        };
        
        // Обработка ICE кандидатов
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('[Call] ICE кандидат:', event.candidate.type);
                
                const targetId = this.currentCall.isInitiator 
                    ? this.currentCall.targetUserId 
                    : this.currentCall.callerId;
                
                if (window.ws && window.ws.readyState === 1) {
                    window.ws.send(JSON.stringify({
                        type: 'webrtc_ice',
                        candidate: event.candidate,
                        targetUserId: targetId
                    }));
                }
            }
        };
        
        // Статус соединения
        this.peerConnection.onconnectionstatechange = () => {
            console.log('[Call] Состояние соединения:', this.peerConnection.connectionState);
            
            if (this.peerConnection.connectionState === 'connected') {
                this.updateCallStatus('На связи');
            } else if (this.peerConnection.connectionState === 'disconnected' || 
                       this.peerConnection.connectionState === 'failed') {
                this.updateCallStatus('Соединение потеряно');
                setTimeout(() => this.cleanup(), 2000);
            }
        };
        
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('[Call] ICE состояние:', this.peerConnection.iceConnectionState);
        };
        
        // Если мы инициатор - создаём offer
        if (isInitiator) {
            await this.createAndSendOffer();
        }
    },
    
    // Создать и отправить offer
    async createAndSendOffer() {
        try {
            console.log('[Call] Создаём offer');
            
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: this.currentCall.type === 'video'
            });
            
            await this.peerConnection.setLocalDescription(offer);
            
            if (window.ws && window.ws.readyState === 1) {
                window.ws.send(JSON.stringify({
                    type: 'webrtc_offer',
                    offer: offer,
                    targetUserId: this.currentCall.targetUserId
                }));
            }
        } catch (e) {
            console.error('[Call] Ошибка создания offer:', e);
        }
    },
    
    // Обработать входящий offer
    async handleOffer(data) {
        console.log('[Call] Получен offer');
        
        if (!this.peerConnection) {
            console.error('[Call] PeerConnection не создан!');
            return;
        }
        
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            const targetId = this.currentCall.callerId;
            
            if (window.ws && window.ws.readyState === 1) {
                window.ws.send(JSON.stringify({
                    type: 'webrtc_answer',
                    answer: answer,
                    targetUserId: targetId
                }));
            }
        } catch (e) {
            console.error('[Call] Ошибка обработки offer:', e);
        }
    },
    
    // Обработать входящий answer
    async handleAnswer(data) {
        console.log('[Call] Получен answer');
        
        if (!this.peerConnection) {
            console.error('[Call] PeerConnection не создан!');
            return;
        }
        
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (e) {
            console.error('[Call] Ошибка обработки answer:', e);
        }
    },
    
    // Обработать ICE кандидат
    async handleIceCandidate(data) {
        console.log('[Call] Получен ICE кандидат');
        
        if (!this.peerConnection || !data.candidate) {
            return;
        }
        
        try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
            console.error('[Call] Ошибка добавления ICE:', e);
        }
    },
    
    // Звонок принят - инициатор начинает WebRTC
    async onCallAccepted() {
        console.log('[Call] Звонок принят!');
        this.currentCall.status = 'connecting';
        this.updateCallStatus('Соединение...');
        
        await this.createPeerConnection(true);
    },
    
    // UI звонка
    showCallUI(type, userName, isWaiting) {
        const initial = userName ? userName.charAt(0).toUpperCase() : '?';
        const statusText = isWaiting ? 'Вызов...' : 'Соединение...';
        const pulseClass = isWaiting ? 'pulse-call' : '';
        
        let videoHtml = '';
        if (type === 'video') {
            videoHtml = `
                <div class="relative mb-4 bg-gray-900 rounded-2xl overflow-hidden" style="aspect-ratio: 16/9;">
                    <video id="remoteVideo" autoplay playsinline class="w-full h-full object-cover"></video>
                    <audio id="remoteAudio" autoplay></audio>
                    ${this.hasCamera ? '<video id="localVideo" autoplay playsinline muted class="absolute bottom-4 right-4 w-32 rounded-xl bg-gray-700 shadow-lg"></video>' : '<div class="absolute bottom-4 right-4 w-32 h-24 rounded-xl bg-gray-700 shadow-lg flex items-center justify-center text-white/50 text-xs">Камера выкл</div>'}
                </div>
            `;
        } else {
            videoHtml = `
                <div class="w-28 h-28 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-4xl font-bold mb-4 ${pulseClass}">${initial}</div>
                <audio id="remoteAudio" autoplay></audio>
            `;
        }
        
        const html = `
            <div class="fixed inset-0 modal-overlay flex items-center justify-center z-50 fade-in" id="callModal">
                <div class="bg-gray-800 rounded-3xl p-8 text-center max-w-md w-full mx-4 shadow-2xl">
                    ${videoHtml}
                    <h3 class="text-xl font-semibold mb-2">${this.escapeHtml(userName)}</h3>
                    <p class="text-white/50 mb-4" id="callStatus">${statusText}</p>
                    <p class="text-3xl font-mono mb-6 text-purple-300" id="callTimer">00:00</p>
                    <div class="flex justify-center gap-4">
                        <button id="muteBtn" onclick="CallManager.toggleMute()" 
                            class="w-14 h-14 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition" title="Микрофон">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                            </svg>
                        </button>
                        ${type === 'video' ? `
                        <button id="videoBtn" onclick="CallManager.toggleVideo()" 
                            class="w-14 h-14 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition" title="Камера">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                            </svg>
                        </button>
                        ` : ''}
                        <button onclick="CallManager.endCall()" 
                            class="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition shadow-lg shadow-red-500/30" title="Завершить">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        const modals = document.getElementById('modals');
        if (modals) {
            modals.innerHTML = html;
        }
        
        // Подключаем локальное видео
        if (type === 'video' && this.hasCamera && this.localStream) {
            setTimeout(() => {
                const localVideo = document.getElementById('localVideo');
                if (localVideo) {
                    localVideo.srcObject = this.localStream;
                }
            }, 100);
        }
    },
    
    // Показать входящий звонок
    showIncomingCall(data) {
        const initial = data.callerName ? data.callerName.charAt(0).toUpperCase() : '?';
        const callTypeText = data.callType === 'video' ? 'Видеозвонок' : 'Аудиозвонок';
        
        const html = `
            <div class="fixed inset-0 modal-overlay flex items-center justify-center z-50 fade-in" id="incomingCallModal">
                <div class="bg-gray-800 rounded-3xl p-8 text-center max-w-sm w-full mx-4 shadow-2xl">
                    <div class="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl font-bold mb-4 pulse-call">${initial}</div>
                    <h3 class="text-xl font-semibold mb-2">${this.escapeHtml(data.callerName)}</h3>
                    <p class="text-white/50 mb-8">${callTypeText}</p>
                    <div class="flex justify-center gap-6">
                        <button onclick="CallManager.rejectCall('${data.callId}')" 
                            class="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition shadow-lg shadow-red-500/30">
                            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                        <button onclick="CallManager.acceptCall(${JSON.stringify(data).replace(/"/g, '&quot;')})" 
                            class="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition shadow-lg shadow-green-500/30">
                            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        const modals = document.getElementById('modals');
        if (modals) {
            modals.innerHTML = html;
        }
        
        // Воспроизводим звук звонка (если есть)
        this.playRingtone();
    },
    
    // Переключить микрофон
    toggleMute() {
        if (!this.localStream) return;
        
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            this.isMuted = !audioTrack.enabled;
            
            const btn = document.getElementById('muteBtn');
            if (btn) {
                if (this.isMuted) {
                    btn.classList.remove('bg-gray-700');
                    btn.classList.add('bg-red-500');
                } else {
                    btn.classList.remove('bg-red-500');
                    btn.classList.add('bg-gray-700');
                }
            }
        }
    },
    
    // Переключить камеру
    toggleVideo() {
        if (!this.localStream) return;
        
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            this.isVideoOff = !videoTrack.enabled;
            
            const btn = document.getElementById('videoBtn');
            if (btn) {
                if (this.isVideoOff) {
                    btn.classList.remove('bg-gray-700');
                    btn.classList.add('bg-red-500');
                } else {
                    btn.classList.remove('bg-red-500');
                    btn.classList.add('bg-gray-700');
                }
            }
        }
    },
    
    // Обновить статус звонка
    updateCallStatus(status) {
        const statusEl = document.getElementById('callStatus');
        if (statusEl) {
            statusEl.textContent = status;
        }
    },
    
    // Запустить таймер звонка
    startCallTimer() {
        if (this.callTimerInterval) return;
        
        this.callStartTime = Date.now();
        this.callTimerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.callStartTime) / 1000);
            const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const secs = (elapsed % 60).toString().padStart(2, '0');
            
            const timerEl = document.getElementById('callTimer');
            if (timerEl) {
                timerEl.textContent = mins + ':' + secs;
            }
        }, 1000);
    },
    
    // Воспроизвести рингтон
    playRingtone() {
        // Можно добавить звук звонка
    },
    
    // Остановить рингтон
    stopRingtone() {
        // Остановить звук
    },
    
    // Показать ошибку
    showError(message) {
        alert(message);
    },
    
    // Очистка
    cleanup() {
        console.log('[Call] Очистка звонка');
        
        this.stopRingtone();
        
        if (this.callTimerInterval) {
            clearInterval(this.callTimerInterval);
            this.callTimerInterval = null;
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        this.remoteStream = null;
        this.currentCall = null;
        this.callStartTime = null;
        this.isMuted = false;
        this.isVideoOff = false;
        
        const modals = document.getElementById('modals');
        if (modals) {
            modals.innerHTML = '';
        }
    },
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

console.log('[Call] Модуль загружен');
