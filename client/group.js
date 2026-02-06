// Maxutra Group Manager
// Группы, каналы и групповые звонки

const GroupManager = {
    groups: [],
    currentGroup: null,
    
    // Создать группу
    async createGroup(name, members = [], isChannel = false) {
        console.log('[Group] Создаём группу:', name, 'канал:', isChannel);
        
        try {
            const res = await fetch(window.API_URL + '/api/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name,
                    creatorId: window.currentUser.id,
                    members: members,
                    isChannel: isChannel
                })
            });
            
            const data = await res.json();
            
            if (data.success) {
                this.groups.push(data.group);
                return data.group;
            }
        } catch (e) {
            console.error('[Group] Ошибка создания группы:', e);
        }
        
        return null;
    },
    
    // Загрузить группы пользователя
    async loadGroups() {
        try {
            const res = await fetch(window.API_URL + '/api/groups/' + window.currentUser.id);
            const data = await res.json();
            this.groups = data.groups || [];
            return this.groups;
        } catch (e) {
            console.error('[Group] Ошибка загрузки групп:', e);
            return [];
        }
    },
    
    // Показать диалог создания группы
    showCreateGroupDialog() {
        const html = `
            <div class="fixed inset-0 modal-overlay flex items-center justify-center z-50 fade-in" id="createGroupModal">
                <div class="bg-gray-800 rounded-3xl p-6 max-w-md w-full mx-4 shadow-2xl">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-xl font-semibold">Создать группу</h2>
                        <button onclick="GroupManager.closeModal()" class="p-2 hover:bg-white/10 rounded-lg transition">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm text-white/70 mb-2">Название группы</label>
                            <input type="text" id="groupName" placeholder="Моя группа"
                                class="input-field w-full rounded-xl px-4 py-3 outline-none text-white">
                        </div>
                        
                        <div>
                            <label class="block text-sm text-white/70 mb-2">Тип</label>
                            <div class="flex gap-3">
                                <label class="flex-1 cursor-pointer">
                                    <input type="radio" name="groupType" value="group" checked class="hidden peer">
                                    <div class="p-3 rounded-xl border border-white/20 peer-checked:border-purple-500 peer-checked:bg-purple-500/20 text-center transition">
                                        <svg class="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                        </svg>
                                        <span class="text-sm">Группа</span>
                                    </div>
                                </label>
                                <label class="flex-1 cursor-pointer">
                                    <input type="radio" name="groupType" value="channel" class="hidden peer">
                                    <div class="p-3 rounded-xl border border-white/20 peer-checked:border-purple-500 peer-checked:bg-purple-500/20 text-center transition">
                                        <svg class="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"></path>
                                        </svg>
                                        <span class="text-sm">Канал</span>
                                    </div>
                                </label>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm text-white/70 mb-2">Добавить участников</label>
                            <input type="text" id="groupMembersSearch" placeholder="Поиск..."
                                oninput="GroupManager.searchMembers()"
                                class="input-field w-full rounded-xl px-4 py-3 outline-none text-white mb-2">
                            <div id="groupMembersResults" class="max-h-40 overflow-y-auto"></div>
                            <div id="selectedMembers" class="flex flex-wrap gap-2 mt-2"></div>
                        </div>
                        
                        <button onclick="GroupManager.submitCreateGroup()" 
                            class="btn-primary w-full rounded-xl py-3 font-semibold text-white mt-4">
                            Создать
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        const modals = document.getElementById('modals');
        if (modals) {
            modals.innerHTML = html;
        }
        
        this.selectedMembers = [];
    },
    
    selectedMembers: [],
    
    // Поиск участников для добавления
    async searchMembers() {
        const query = document.getElementById('groupMembersSearch').value.trim();
        const resultsEl = document.getElementById('groupMembersResults');
        
        if (query.length < 2) {
            resultsEl.innerHTML = '';
            return;
        }
        
        try {
            const res = await fetch(window.API_URL + '/api/users/search?query=' + encodeURIComponent(query) + '&currentUserId=' + window.currentUser.id);
            const users = await res.json();
            
            resultsEl.innerHTML = users.map(user => {
                const isSelected = this.selectedMembers.find(m => m.id === user.id);
                const selectedClass = isSelected ? 'bg-purple-500/30' : '';
                
                return `
                    <div onclick="GroupManager.toggleMember('${user.id}', '${this.escapeHtml(user.displayName)}')" 
                        class="p-2 hover:bg-white/10 cursor-pointer transition rounded-lg flex items-center gap-2 ${selectedClass}">
                        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-semibold">
                            ${user.displayName.charAt(0).toUpperCase()}
                        </div>
                        <span>${this.escapeHtml(user.displayName)}</span>
                        ${isSelected ? '<svg class="w-4 h-4 ml-auto text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>' : ''}
                    </div>
                `;
            }).join('');
        } catch (e) {
            console.error('[Group] Ошибка поиска:', e);
        }
    },
    
    // Добавить/убрать участника
    toggleMember(userId, displayName) {
        const index = this.selectedMembers.findIndex(m => m.id === userId);
        
        if (index >= 0) {
            this.selectedMembers.splice(index, 1);
        } else {
            this.selectedMembers.push({ id: userId, displayName: displayName });
        }
        
        this.updateSelectedMembersUI();
        this.searchMembers(); // Обновить список
    },
    
    // Обновить UI выбранных участников
    updateSelectedMembersUI() {
        const container = document.getElementById('selectedMembers');
        if (!container) return;
        
        container.innerHTML = this.selectedMembers.map(member => `
            <div class="bg-purple-500/30 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                ${this.escapeHtml(member.displayName)}
                <button onclick="GroupManager.toggleMember('${member.id}', '')" class="hover:text-red-400">×</button>
            </div>
        `).join('');
    },
    
    // Создать группу (отправка)
    async submitCreateGroup() {
        const name = document.getElementById('groupName').value.trim();
        const isChannel = document.querySelector('input[name="groupType"]:checked').value === 'channel';
        
        if (!name) {
            alert('Введите название группы');
            return;
        }
        
        const memberIds = this.selectedMembers.map(m => m.id);
        
        const group = await this.createGroup(name, memberIds, isChannel);
        
        if (group) {
            this.closeModal();
            if (typeof loadChats === 'function') {
                loadChats();
            }
        }
    },
    
    // Закрыть модальное окно
    closeModal() {
        const modals = document.getElementById('modals');
        if (modals) {
            modals.innerHTML = '';
        }
    },
    
    // === Групповые звонки ===
    
    groupCallParticipants: [],
    groupCallStreams: new Map(),
    groupCallConnections: new Map(),
    
    // Начать групповой звонок
    async startGroupCall(groupId, participants, callType = 'audio') {
        console.log('[Group] Начинаем групповой звонок:', groupId, participants);
        
        // Получаем свой медиа поток
        const mediaResult = await PermissionsManager.getMediaStream({
            audio: true,
            video: callType === 'video'
        });
        
        if (!mediaResult.success) {
            alert(mediaResult.error);
            return;
        }
        
        CallManager.localStream = mediaResult.stream;
        this.groupCallParticipants = participants;
        
        // Генерируем ID группового звонка
        const groupCallId = 'gcall_' + Date.now();
        
        // Отправляем приглашения всем участникам
        participants.forEach(participantId => {
            if (participantId !== window.currentUser.id) {
                if (window.ws && window.ws.readyState === 1) {
                    window.ws.send(JSON.stringify({
                        type: 'group_call_invite',
                        groupCallId: groupCallId,
                        groupId: groupId,
                        callerId: window.currentUser.id,
                        callerName: window.currentUser.displayName || window.currentUser.username,
                        targetUserId: participantId,
                        callType: callType,
                        participants: participants
                    }));
                }
            }
        });
        
        // Показываем UI группового звонка
        this.showGroupCallUI(groupCallId, callType, participants);
    },
    
    // Показать диалог выбора участников для группового звонка
    showGroupCallDialog(preselectedUserId = null) {
        const settings = this.getDevSettings();
        
        if (!settings.groupCallsEnabled) {
            alert('Групповые звонки отключены в настройках разработчика');
            return;
        }
        
        const html = `
            <div class="fixed inset-0 modal-overlay flex items-center justify-center z-50 fade-in" id="groupCallDialog">
                <div class="bg-gray-800 rounded-3xl p-6 max-w-md w-full mx-4 shadow-2xl">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-xl font-semibold">Групповой звонок</h2>
                        <button onclick="GroupManager.closeModal()" class="p-2 hover:bg-white/10 rounded-lg transition">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="space-y-4">
                        <p class="text-sm text-white/70">Выберите участников звонка:</p>
                        
                        <input type="text" id="groupCallSearch" placeholder="Поиск..."
                            oninput="GroupManager.searchGroupCallMembers()"
                            class="input-field w-full rounded-xl px-4 py-3 outline-none text-white">
                        
                        <div id="groupCallMembersResults" class="max-h-48 overflow-y-auto"></div>
                        <div id="groupCallSelectedMembers" class="flex flex-wrap gap-2"></div>
                        
                        <div class="flex gap-3">
                            <button onclick="GroupManager.initiateGroupCall('audio')" 
                                class="flex-1 py-3 rounded-xl bg-green-500 hover:bg-green-600 transition font-medium flex items-center justify-center gap-2">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                                </svg>
                                Аудио
                            </button>
                            <button onclick="GroupManager.initiateGroupCall('video')" 
                                class="flex-1 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 transition font-medium flex items-center justify-center gap-2">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                </svg>
                                Видео
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const modals = document.getElementById('modals');
        if (modals) {
            modals.innerHTML = html;
        }
        
        this.groupCallSelectedMembers = [];
        
        // Если есть предвыбранный пользователь
        if (preselectedUserId && window.otherUserData) {
            this.groupCallSelectedMembers.push({
                id: preselectedUserId,
                displayName: window.otherUserData.displayName || 'Собеседник'
            });
            this.updateGroupCallSelectedUI();
        }
    },
    
    groupCallSelectedMembers: [],
    
    // Поиск для группового звонка
    async searchGroupCallMembers() {
        const query = document.getElementById('groupCallSearch').value.trim();
        const resultsEl = document.getElementById('groupCallMembersResults');
        
        if (query.length < 2) {
            resultsEl.innerHTML = '';
            return;
        }
        
        try {
            const res = await fetch(window.API_URL + '/api/users/search?query=' + encodeURIComponent(query) + '&currentUserId=' + window.currentUser.id);
            const users = await res.json();
            
            resultsEl.innerHTML = users.map(user => {
                const isSelected = this.groupCallSelectedMembers.find(m => m.id === user.id);
                
                return `
                    <div onclick="GroupManager.toggleGroupCallMember('${user.id}', '${this.escapeHtml(user.displayName)}')" 
                        class="p-2 hover:bg-white/10 cursor-pointer transition rounded-lg flex items-center gap-2 ${isSelected ? 'bg-purple-500/30' : ''}">
                        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-semibold">
                            ${user.displayName.charAt(0).toUpperCase()}
                        </div>
                        <span>${this.escapeHtml(user.displayName)}</span>
                        ${isSelected ? '<svg class="w-4 h-4 ml-auto text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>' : ''}
                    </div>
                `;
            }).join('');
        } catch (e) {
            console.error('[Group] Ошибка поиска:', e);
        }
    },
    
    toggleGroupCallMember(userId, displayName) {
        const index = this.groupCallSelectedMembers.findIndex(m => m.id === userId);
        
        if (index >= 0) {
            this.groupCallSelectedMembers.splice(index, 1);
        } else {
            this.groupCallSelectedMembers.push({ id: userId, displayName: displayName });
        }
        
        this.updateGroupCallSelectedUI();
        this.searchGroupCallMembers();
    },
    
    updateGroupCallSelectedUI() {
        const container = document.getElementById('groupCallSelectedMembers');
        if (!container) return;
        
        container.innerHTML = this.groupCallSelectedMembers.map(member => `
            <div class="bg-purple-500/30 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                ${this.escapeHtml(member.displayName)}
                <button onclick="GroupManager.toggleGroupCallMember('${member.id}', '')" class="hover:text-red-400">×</button>
            </div>
        `).join('');
    },
    
    // Инициировать групповой звонок
    async initiateGroupCall(callType) {
        if (this.groupCallSelectedMembers.length === 0) {
            alert('Выберите хотя бы одного участника');
            return;
        }
        
        const participants = [window.currentUser.id, ...this.groupCallSelectedMembers.map(m => m.id)];
        this.closeModal();
        
        await this.startGroupCall(null, participants, callType);
    },
    
    // UI группового звонка
    showGroupCallUI(groupCallId, callType, participants) {
        const participantsHtml = participants.map(p => {
            const initial = p === window.currentUser.id ? 'Я' : '?';
            return `
                <div class="text-center">
                    <div class="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl font-bold mx-auto mb-1">
                        ${initial}
                    </div>
                    <p class="text-xs text-white/70 truncate w-16">${p === window.currentUser.id ? 'Вы' : 'Участник'}</p>
                </div>
            `;
        }).join('');
        
        const html = `
            <div class="fixed inset-0 modal-overlay flex items-center justify-center z-50 fade-in" id="groupCallModal">
                <div class="bg-gray-800 rounded-3xl p-8 text-center max-w-lg w-full mx-4 shadow-2xl">
                    <h3 class="text-xl font-semibold mb-4">Групповой звонок</h3>
                    
                    <div class="flex justify-center gap-4 flex-wrap mb-6">
                        ${participantsHtml}
                    </div>
                    
                    <p class="text-white/50 mb-4" id="groupCallStatus">Ожидание участников...</p>
                    <p class="text-3xl font-mono mb-6 text-purple-300" id="groupCallTimer">00:00</p>
                    
                    <div class="flex justify-center gap-4">
                        <button onclick="CallManager.toggleMute()" 
                            class="w-14 h-14 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition" id="muteBtn">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                            </svg>
                        </button>
                        <button onclick="GroupManager.endGroupCall()" 
                            class="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition shadow-lg shadow-red-500/30">
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
    },
    
    endGroupCall() {
        // Закрываем все соединения
        this.groupCallConnections.forEach(pc => pc.close());
        this.groupCallConnections.clear();
        this.groupCallStreams.clear();
        this.groupCallParticipants = [];
        
        CallManager.cleanup();
    },
    
    // === Настройки разработчика ===
    
    devClickCount: 0,
    devClickTimeout: null,
    
    // Обработка кликов на MAX soft
    handleDevClick() {
        this.devClickCount++;
        
        clearTimeout(this.devClickTimeout);
        this.devClickTimeout = setTimeout(() => {
            this.devClickCount = 0;
        }, 3000);
        
        if (this.devClickCount >= 10) {
            this.devClickCount = 0;
            this.showDevSettings();
        }
    },
    
    // Показать настройки разработчика
    showDevSettings() {
        const settings = this.getDevSettings();
        
        const html = `
            <div class="fixed inset-0 modal-overlay flex items-center justify-center z-50 fade-in" id="devSettingsModal">
                <div class="bg-gray-800 rounded-3xl p-6 max-w-md w-full mx-4 shadow-2xl border-2 border-purple-500">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-xl font-semibold text-purple-400">🔧 Меню разработчика</h2>
                        <button onclick="GroupManager.closeModal()" class="p-2 hover:bg-white/10 rounded-lg transition">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="space-y-4">
                        <div class="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                            <div>
                                <p class="font-medium">Эмодзи</p>
                                <p class="text-sm text-white/50">Показать кнопку эмодзи</p>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="devEmojiEnabled" ${settings.emojiEnabled ? 'checked' : ''} 
                                    onchange="GroupManager.saveDevSettings()" class="sr-only peer">
                                <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                            </label>
                        </div>
                        
                        <div class="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                            <div>
                                <p class="font-medium">Групповые звонки</p>
                                <p class="text-sm text-white/50">Включить в обычных чатах</p>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="devGroupCallsEnabled" ${settings.groupCallsEnabled ? 'checked' : ''} 
                                    onchange="GroupManager.saveDevSettings()" class="sr-only peer">
                                <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                            </label>
                        </div>
                        
                        <div class="mt-6 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-xl">
                            <p class="text-yellow-300 text-sm text-center">⚠️ Эти функции экспериментальные</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const modals = document.getElementById('modals');
        if (modals) {
            modals.innerHTML = html;
        }
    },
    
    // Получить настройки разработчика
    getDevSettings() {
        try {
            const saved = localStorage.getItem('maxutra_dev_settings');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {}
        
        return {
            emojiEnabled: false,
            groupCallsEnabled: false
        };
    },
    
    // Сохранить настройки разработчика
    saveDevSettings() {
        const settings = {
            emojiEnabled: document.getElementById('devEmojiEnabled')?.checked || false,
            groupCallsEnabled: document.getElementById('devGroupCallsEnabled')?.checked || false
        };
        
        localStorage.setItem('maxutra_dev_settings', JSON.stringify(settings));
        console.log('[Group] Настройки разработчика сохранены:', settings);
        
        // Обновляем UI если нужно
        if (typeof updateChatInputUI === 'function') {
            updateChatInputUI();
        }
    },
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

console.log('[Group] Модуль загружен');
