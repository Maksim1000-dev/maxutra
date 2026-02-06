// Maxutra Permissions Manager
// Управление разрешениями камеры и микрофона

const PermissionsManager = {
    // Статусы разрешений
    permissions: {
        microphone: 'unknown',
        camera: 'unknown'
    },
    
    // Проверить статус разрешений
    async checkPermissions() {
        try {
            // Проверка микрофона
            if (navigator.permissions) {
                try {
                    const micResult = await navigator.permissions.query({ name: 'microphone' });
                    this.permissions.microphone = micResult.state;
                    micResult.onchange = () => {
                        this.permissions.microphone = micResult.state;
                        console.log('[Permissions] Микрофон:', micResult.state);
                    };
                } catch (e) {
                    console.log('[Permissions] Не удалось проверить микрофон через API');
                }
                
                // Проверка камеры
                try {
                    const camResult = await navigator.permissions.query({ name: 'camera' });
                    this.permissions.camera = camResult.state;
                    camResult.onchange = () => {
                        this.permissions.camera = camResult.state;
                        console.log('[Permissions] Камера:', camResult.state);
                    };
                } catch (e) {
                    console.log('[Permissions] Не удалось проверить камеру через API');
                }
            }
        } catch (e) {
            console.log('[Permissions] Permissions API не поддерживается');
        }
        
        return this.permissions;
    },
    
    // Запросить доступ к микрофону
    async requestMicrophone() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.permissions.microphone = 'granted';
            // Сразу останавливаем трек, нам нужно было только разрешение
            stream.getTracks().forEach(track => track.stop());
            return { success: true, stream: null };
        } catch (e) {
            console.error('[Permissions] Ошибка доступа к микрофону:', e);
            this.permissions.microphone = 'denied';
            return { success: false, error: this.getErrorMessage(e) };
        }
    },
    
    // Запросить доступ к камере
    async requestCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.permissions.camera = 'granted';
            stream.getTracks().forEach(track => track.stop());
            return { success: true, stream: null };
        } catch (e) {
            console.error('[Permissions] Ошибка доступа к камере:', e);
            this.permissions.camera = 'denied';
            return { success: false, error: this.getErrorMessage(e) };
        }
    },
    
    // Получить медиа поток для звонка
    async getMediaStream(options = { audio: true, video: false }) {
        const constraints = {
            audio: options.audio ? {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } : false,
            video: options.video ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            } : false
        };
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            return { success: true, stream: stream };
        } catch (e) {
            console.error('[Permissions] Ошибка получения медиа:', e);
            
            // Если не удалось получить видео, пробуем только аудио
            if (options.video && options.audio) {
                console.log('[Permissions] Пробуем только аудио...');
                try {
                    const audioStream = await navigator.mediaDevices.getUserMedia({ 
                        audio: constraints.audio, 
                        video: false 
                    });
                    return { success: true, stream: audioStream, videoFailed: true };
                } catch (audioError) {
                    return { success: false, error: this.getErrorMessage(audioError) };
                }
            }
            
            return { success: false, error: this.getErrorMessage(e) };
        }
    },
    
    // Проверить наличие устройств
    async getAvailableDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            
            const result = {
                microphones: devices.filter(d => d.kind === 'audioinput'),
                cameras: devices.filter(d => d.kind === 'videoinput'),
                speakers: devices.filter(d => d.kind === 'audiooutput'),
                hasMicrophone: devices.some(d => d.kind === 'audioinput'),
                hasCamera: devices.some(d => d.kind === 'videoinput')
            };
            
            console.log('[Permissions] Устройства:', result);
            return result;
        } catch (e) {
            console.error('[Permissions] Ошибка получения устройств:', e);
            return {
                microphones: [],
                cameras: [],
                speakers: [],
                hasMicrophone: false,
                hasCamera: false
            };
        }
    },
    
    // Показать диалог запроса разрешений
    showPermissionDialog(type, onAllow, onDeny) {
        const titles = {
            microphone: 'Доступ к микрофону',
            camera: 'Доступ к камере',
            both: 'Доступ к камере и микрофону'
        };
        
        const descriptions = {
            microphone: 'Для голосовых звонков нужен доступ к микрофону',
            camera: 'Для видеозвонков нужен доступ к камере',
            both: 'Для видеозвонков нужен доступ к камере и микрофону'
        };
        
        const iconSvg = type === 'microphone' 
            ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>'
            : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>';
        
        const dialogHtml = `
            <div class="fixed inset-0 modal-overlay flex items-center justify-center z-50 fade-in" id="permissionDialog">
                <div class="bg-gray-800 rounded-3xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
                    <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            ${iconSvg}
                        </svg>
                    </div>
                    <h3 class="text-xl font-semibold mb-2">${titles[type]}</h3>
                    <p class="text-white/60 mb-6">${descriptions[type]}</p>
                    <div class="flex gap-3">
                        <button onclick="PermissionsManager.handlePermissionDeny()" 
                            class="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 transition font-medium">
                            Отмена
                        </button>
                        <button onclick="PermissionsManager.handlePermissionAllow()" 
                            class="flex-1 py-3 rounded-xl btn-primary font-medium">
                            Разрешить
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Сохраняем колбэки
        this._onAllow = onAllow;
        this._onDeny = onDeny;
        this._permissionType = type;
        
        // Добавляем диалог
        const modals = document.getElementById('modals');
        if (modals) {
            modals.innerHTML = dialogHtml;
        }
    },
    
    async handlePermissionAllow() {
        const dialog = document.getElementById('permissionDialog');
        if (dialog) dialog.remove();
        
        if (this._onAllow) {
            this._onAllow();
        }
    },
    
    handlePermissionDeny() {
        const dialog = document.getElementById('permissionDialog');
        if (dialog) dialog.remove();
        
        if (this._onDeny) {
            this._onDeny();
        }
    },
    
    // Получить понятное сообщение об ошибке
    getErrorMessage(error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            return 'Доступ запрещён. Разрешите доступ в настройках браузера.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            return 'Устройство не найдено. Подключите камеру или микрофон.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            return 'Устройство занято другим приложением.';
        } else if (error.name === 'OverconstrainedError') {
            return 'Устройство не поддерживает требуемые параметры.';
        } else if (error.name === 'TypeError') {
            return 'Неверные параметры запроса.';
        }
        return 'Не удалось получить доступ к устройству: ' + error.message;
    }
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    PermissionsManager.checkPermissions();
});

console.log('[Permissions] Модуль загружен');
