// Maxutra Call Manager
// Полная логика звонков с демонстрацией экрана, сворачиванием и звуками

const CallManager = {
    // Состояние звонка
    currentCall: null,
    peerConnection: null,
    localStream: null,
    remoteStream: null,
    screenStream: null,
    callStartTime: null,
    callTimerInterval: null,
    isMuted: false,
    isVideoOff: false,
    isScreenSharing: false,
    isMinimized: false,
    hasCamera: true,
    ringtoneAudio: null,
    messageSound: null,
    
    // ICE серверы для WebRTC
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
    ],
    
    // Инициализация звуков
    initSounds() {
        // Создаём звуки через Web Audio API
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    },
    
    // Генерация звука звонка
    playRingtone() {
        this.stopRingtone();
        
        try {
            if (!this.audioContext) this.initSounds();
            
            const playTone = () => {
                if (!this.ringtoneInterval) return;
                
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.frequency.value = 440;
                oscillator.type = 'sine';
                
                gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
                
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.5);
            };
            
            playTone();
            this.ringtoneInterval = setInterval(playTone, 1000);
        } catch (e) {
            console.log('[Call] Не удалось воспроизвести звук:', e);
        }
    },
    
    stopRingtone() {
        if (this.ringtoneInterval) {
            clearInterval(this.ringtoneInterval);
            this.ringtoneInterval = null;
        }
    },
    
    // Звук нового сообщения
    playMessageSound() {
        try {
            if (!this.audioContext) this.initSounds();
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(880, this.audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1100, this.audioContext.currentTime + 0.1);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.2);
        } catch (e) {
            console.log('[Call] Не удалось воспроизвести звук сообщения:', e);
        }
    },
    
    // Начать исходящий звонок
    async startCall(type, targetUserId, targetUserName) {
        console.log('[Call] Начинаем звонок:', type, 'для', targetUserName);
        
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
        }
        
        const callId = 'call_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        this.currentCall = {
            id: callId,
            type: type,
            isInitiator: true,
            targetUserId: targetUserId,
            targetUserName: targetUserName,
            status: 'calling'
        };
        
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
        
        this.showCallUI(type, targetUserName, true);
        this.playRingtone();
        
        return true;
    },
    
    // Принять входящий звонок
    async acceptCall(callData) {
        console.log('[Call] Принимаем звонок:', callData);
        this.stopRingtone();
        
        const type = callData.callType || 'audio';
        const devices = await PermissionsManager.getAvailableDevices();
        
        if (!devices.hasMicrophone) {
            this.showError('Микрофон не найден!');
            this.rejectCall(callData.callId);
            return;
        }
        
        this.hasCamera = type === 'video' && devices.hasCamera;
        
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
        
        if (window.ws && window.ws.readyState === 1) {
            window.ws.send(JSON.stringify({
                type: 'call_accept',
                callId: callData.callId
            }));
        }
        
        this.showCallUI(type, callData.callerName, false);
        await this.createPeerConnection(false);
    },
    
    // Отклонить звонок
    rejectCall(callId) {
        console.log('[Call] Отклоняем звонок:', callId);
        this.stopRingtone();
        
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
        this.stopRingtone();
        
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
        
        this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers });
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                console.log('[Call] Добавляем локальный трек:', track.kind);
                this.peerConnection.addTrack(track, this.localStream);
            });
        }
        
        this.peerConnection.ontrack = (event) => {
            console.log('[Call] Получен удалённый трек:', event.track.kind);
            
            const stream = event.streams[0] || new MediaStream([event.track]);
            
            if (!this.remoteStream) {
                this.remoteStream = stream;
            } else if (!this.remoteStream.getTrackById(event.track.id)) {
                this.remoteStream.addTrack(event.track);
            }
            
            const remoteVideo = document.getElementById('remoteVideo');
            const remoteAudio = document.getElementById('remoteAudio');
            
            if (event.track.kind === 'video' && remoteVideo) {
                if (remoteVideo.srcObject !== stream) {
                    remoteVideo.srcObject = stream;
                }
                remoteVideo.muted = true;
                remoteVideo.play().catch(e => console.log('[Call] Autoplay видео:', e));
            }
            
            if (event.track.kind === 'audio' && remoteAudio) {
                if (remoteAudio.srcObject !== stream) {
                    remoteAudio.srcObject = stream;
                }
                remoteAudio.play().then(() => {
                    remoteAudio.muted = false;
                    console.log('[Call] Аудио воспроизводится');
                }).catch(e => {
                    console.log('[Call] Autoplay заблокирован:', e);
                    this.showUnmuteButton();
                });
            }
            
            this.updateCallStatus('На связи');
            this.startCallTimer();
        };
        
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
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
        
        if (isInitiator) {
            await this.createAndSendOffer();
        }
    },
    
    async createAndSendOffer() {
        try {
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
    
    async handleOffer(data) {
        console.log('[Call] Получен offer');
        if (!this.peerConnection) return;
        
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            if (window.ws && window.ws.readyState === 1) {
                window.ws.send(JSON.stringify({
                    type: 'webrtc_answer',
                    answer: answer,
                    targetUserId: this.currentCall.callerId
                }));
            }
        } catch (e) {
            console.error('[Call] Ошибка обработки offer:', e);
        }
    },
    
    async handleAnswer(data) {
        console.log('[Call] Получен answer');
        if (!this.peerConnection) return;
        
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (e) {
            console.error('[Call] Ошибка обработки answer:', e);
        }
    },
    
    async handleIceCandidate(data) {
        if (!this.peerConnection || !data.candidate) return;
        
        try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
            console.error('[Call] Ошибка добавления ICE:', e);
        }
    },
    
    async onCallAccepted() {
        console.log('[Call] Звонок принят!');
        this.stopRingtone();
        this.currentCall.status = 'connecting';
        this.updateCallStatus('Соединение...');
        await this.createPeerConnection(true);
    },
    
    // Демонстрация экрана - ИСПРАВЛЕНО
    async toggleScreenShare() {
        if (this.isScreenSharing) {
            this.stopScreenShare();
        } else {
            await this.startScreenShare();
        }
    },
    
    async startScreenShare() {
        if (!this.peerConnection) {
            this.showError('Нет активного соединения');
            return;
        }
        
        try {
            // Запрашиваем демонстрацию экрана
            this.screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    displaySurface: 'monitor'
                },
                audio: false
            });
            
            const screenTrack = this.screenStream.getVideoTracks()[0];
            
            if (!screenTrack) {
                throw new Error('Не удалось получить видеотрек экрана');
            }
            
            // Находим sender для видео
            const videoSender = this.peerConnection.getSenders().find(s => 
                s.track && s.track.kind === 'video'
            );
            
            if (videoSender) {
                // Заменяем трек камеры на трек экрана
                await videoSender.replaceTrack(screenTrack);
            } else {
                // Если видео трека нет, добавляем новый
                this.peerConnection.addTrack(screenTrack, this.screenStream);
            }
            
            // Показываем экран в локальном видео
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = this.screenStream;
            }
            
            this.isScreenSharing = true;
            this.updateScreenShareButton();
            
            // Обработка остановки демонстрации
            screenTrack.onended = () => {
                console.log('[Call] Демонстрация остановлена пользователем');
                this.stopScreenShare();
            };
            
            console.log('[Call] Демонстрация экрана началась');
        } catch (e) {
            console.error('[Call] Ошибка демонстрации экрана:', e);
            if (e.name !== 'NotAllowedError') {
                this.showError('Не удалось начать демонстрацию экрана: ' + e.message);
            }
        }
    },
    
    stopScreenShare() {
        // Останавливаем все треки экрана
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => {
                track.stop();
            });
            this.screenStream = null;
        }
        
        // Возвращаем камеру
        if (this.localStream && this.peerConnection) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            
            if (videoTrack) {
                const videoSender = this.peerConnection.getSenders().find(s => 
                    s.track && s.track.kind === 'video'
                );
                
                if (videoSender) {
                    videoSender.replaceTrack(videoTrack).catch(e => {
                        console.error('[Call] Ошибка возврата камеры:', e);
                    });
                }
            }
            
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = this.localStream;
            }
        }
        
        this.isScreenSharing = false;
        this.updateScreenShareButton();
        console.log('[Call] Демонстрация экрана остановлена');
    },
    
    updateScreenShareButton() {
        const btn = document.getElementById('screenShareBtn');
        if (btn) {
            if (this.isScreenSharing) {
                btn.classList.remove('bg-gray-700');
                btn.classList.add('bg-green-500');
                btn.title = 'Остановить демонстрацию';
            } else {
                btn.classList.remove('bg-green-500');
                btn.classList.add('bg-gray-700');
                btn.title = 'Демонстрация экрана';
            }
        }
    },
    
    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        
        const callModal = document.getElementById('callModal');
        const minimizedCall = document.getElementById('minimizedCall');
        
        if (this.isMinimized) {
            if (callModal) callModal.classList.add('hidden');
            this.showMinimizedCall();
        } else {
            if (minimizedCall) minimizedCall.remove();
            if (callModal) callModal.classList.remove('hidden');
        }
    },
    
    showMinimizedCall() {
        const userName = this.currentCall.isInitiator 
            ? this.currentCall.targetUserName 
            : this.currentCall.callerName;
        
        const initial = userName ? userName.charAt(0).toUpperCase() : '?';
        
        const html = `
            <div id="minimizedCall" class="fixed bottom-4 right-4 z-50 fade-in">
                <div class="bg-gray-800 rounded-2xl p-4 shadow-2xl border border-purple-500/50 flex items-center gap-4">
                    <div class="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center font-bold pulse-call">
                        ${initial}
                    </div>
                    <div>
                        <p class="font-medium text-sm">${this.escapeHtml(userName)}</p>
                        <p class="text-xs text-green-400" id="minimizedTimer">00:00</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="CallManager.toggleMinimize()" class="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center transition" title="Развернуть">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
                            </svg>
                        </button>
                        <button onclick="CallManager.endCall()" class="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition" title="Завершить">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <audio id="remoteAudioMinimized" autoplay></audio>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', html);
        
        const remoteAudio = document.getElementById('remoteAudioMinimized');
        if (remoteAudio && this.remoteStream) {
            remoteAudio.srcObject = this.remoteStream;
        }
        
        this.updateMinimizedTimer();
    },
    
    updateMinimizedTimer() {
        if (!this.isMinimized || !this.callStartTime) return;
        
        const timer = document.getElementById('minimizedTimer');
        if (timer) {
            const elapsed = Math.floor((Date.now() - this.callStartTime) / 1000);
            const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const secs = (elapsed % 60).toString().padStart(2, '0');
            timer.textContent = mins + ':' + secs;
        }
    },
    
    showCallUI(type, userName, isWaiting) {
        const initial = userName ? userName.charAt(0).toUpperCase() : '?';
        const statusText = isWaiting ? 'Вызов...' : 'Соединение...';
        const pulseClass = isWaiting ? 'pulse-call' : '';
        
        let videoHtml = '';
        if (type === 'video') {
            videoHtml = `
                <div class="relative mb-4 bg-gray-900 rounded-2xl overflow-hidden" style="aspect-ratio: 16/9; max-height: 50vh;">
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
                <div class="bg-gray-800 rounded-3xl p-6 text-center max-w-lg w-full mx-4 shadow-2xl">
                    <div class="flex justify-end mb-2">
                        <button onclick="CallManager.toggleMinimize()" class="p-2 hover:bg-white/10 rounded-lg transition" title="Свернуть">
                            <svg class="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </button>
                    </div>
                    
                    ${videoHtml}
                    <h3 class="text-xl font-semibold mb-2">${this.escapeHtml(userName)}</h3>
                    <p class="text-white/50 mb-2" id="callStatus">${statusText}</p>
                    <p class="text-3xl font-mono mb-6 text-purple-300" id="callTimer">00:00</p>
                    
                    <div class="flex justify-center gap-3 flex-wrap">
                        <button id="muteBtn" onclick="CallManager.toggleMute()" 
                            class="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition" title="Микрофон">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                            </svg>
                        </button>
                        ${type === 'video' ? `
                        <button id="videoBtn" onclick="CallManager.toggleVideo()" 
                            class="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition" title="Камера">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                            </svg>
                        </button>
                        <button id="screenShareBtn" onclick="CallManager.toggleScreenShare()" 
                            class="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition" title="Демонстрация экрана">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                            </svg>
                        </button>
                        ` : ''}
                        <button onclick="CallManager.endCall()" 
                            class="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition shadow-lg shadow-red-500/30" title="Завершить">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        
        if (type === 'video' && this.hasCamera && this.localStream) {
            setTimeout(() => {
                const localVideo = document.getElementById('localVideo');
                if (localVideo) {
                    localVideo.srcObject = this.localStream;
                }
            }, 100);
        }
    },
    
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
        
        this.playRingtone();
    },
    
    toggleMute() {
        if (!this.localStream) return;
        
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            this.isMuted = !audioTrack.enabled;
            
            const btn = document.getElementById('muteBtn');
            if (btn) {
                btn.classList.toggle('bg-red-500', this.isMuted);
                btn.classList.toggle('bg-gray-700', !this.isMuted);
            }
        }
    },
    
    toggleVideo() {
        if (!this.localStream) return;
        
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            this.isVideoOff = !videoTrack.enabled;
            
            const btn = document.getElementById('videoBtn');
            if (btn) {
                btn.classList.toggle('bg-red-500', this.isVideoOff);
                btn.classList.toggle('bg-gray-700', !this.isVideoOff);
            }
        }
    },
    
    updateCallStatus(status) {
        const statusEl = document.getElementById('callStatus');
        if (statusEl) {
            statusEl.textContent = status;
        }
    },
    
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
            
            this.updateMinimizedTimer();
        }, 1000);
    },
    
    showUnmuteButton() {
        if (document.getElementById('iosUnmuteBtn')) return;
        
        const btn = document.createElement('button');
        btn.id = 'iosUnmuteBtn';
        btn.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-green-500 hover:bg-green-600 rounded-xl font-medium z-50 flex items-center gap-2 shadow-lg animate-pulse';
        btn.innerHTML = '🔊 Нажмите для включения звука';
        btn.onclick = () => {
            const remoteAudio = document.getElementById('remoteAudio');
            if (remoteAudio) {
                remoteAudio.muted = false;
                remoteAudio.play().then(() => btn.remove()).catch(e => console.error(e));
            }
        };
        document.body.appendChild(btn);
    },
    
    showError(message) {
        alert(message);
    },
    
    cleanup() {
        console.log('[Call] Очистка звонка');
        
        this.stopRingtone();
        
        if (this.callTimerInterval) {
            clearInterval(this.callTimerInterval);
            this.callTimerInterval = null;
        }
        
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
            this.screenStream = null;
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
        this.isScreenSharing = false;
        this.isMinimized = false;
        
        const iosBtn = document.getElementById('iosUnmuteBtn');
        if (iosBtn) iosBtn.remove();
        
        const minimizedCall = document.getElementById('minimizedCall');
        if (minimizedCall) minimizedCall.remove();
        
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
