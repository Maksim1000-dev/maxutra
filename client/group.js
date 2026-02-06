// Maxutra Group Manager
// Группы, каналы, групповые звонки и стикеры

const GroupManager = {
    groups: [],
    currentGroup: null,
    
    // Стикеры
    stickers: [
        { id: 's1', url: 'https://cdn.jsdelivr.net/gh/nicgpt/emojis@main/stickers/thumbsup.gif', name: 'Лайк' },
        { id: 's2', url: 'https://cdn.jsdelivr.net/gh/nicgpt/emojis@main/stickers/heart.gif', name: 'Сердце' },
        { id: 's3', url: 'https://cdn.jsdelivr.net/gh/nicgpt/emojis@main/stickers/laugh.gif', name: 'Смех' },
        { id: 's4', url: 'https://cdn.jsdelivr.net/gh/nicgpt/emojis@main/stickers/sad.gif', name: 'Грусть' },
        { id: 's5', url: 'https://cdn.jsdelivr.net/gh/nicgpt/emojis@main/stickers/angry.gif', name: 'Злость' },
        { id: 's6', url: 'https://cdn.jsdelivr.net/gh/nicgpt/emojis@main/stickers/wow.gif', name: 'Вау' },
        // Дефолтные стикеры (текстовые если GIF не загружаются)
        { id: 's7', emoji: '👍', name: 'Супер' },
        { id: 's8', emoji: '❤️', name: 'Люблю' },
        { id: 's9', emoji: '😂', name: 'Ржу' },
        { id: 's10', emoji: '😢', name: 'Плачу' },
        { id: 's11', emoji: '😡', name: 'Злой' },
        { id: 's12', emoji: '🎉', name: 'Праздник' },
        { id: 's13', emoji: '🔥', name: 'Огонь' },
        { id: 's14', emoji: '💯', name: '100%' },
        { id: 's15', emoji: '🤔', name: 'Думаю' },
        { id: 's16', emoji: '👋', name: 'Привет' },
        { id: 's17', emoji: '🙏', name: 'Спасибо' },
        { id: 's18', emoji: '💪', name: 'Сила' }
    ],
    
    // Создать группу
    async createGroup(name, members = [], isChannel = false) {
        console.log('[Group] Создаём группу:', name, 'канал:', isChannel, 'участники:', members);
        
        if (!name || name.trim() === '') {
            console.error('[Group] Имя группы не указано');
            return null;
        }
        
        try {
            const res = await fetch(window.API_URL + '/api/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    creatorId: window.currentUser.id,
                    members: members,
                    isChannel: isChannel
                })
            });
            
            if (!res.ok) {
                console.error('[Group] Ошибка HTTP:', res.status);
                return null;
            }
            
            const data = await res.json();
            console.log('[Group] Ответ сервера:', data);
            
            if (data.success && data.group) {
                this.groups.push(data.group);
                console.log('[Group] Группа создана успешно:', data.group);
                return data.group;
            } else {
                console.error('[Group] Группа не создана:', data);
                return null;
            }
        } catch (e) {
            console.error('[Group] Ошибка создания группы:', e);
            return null;
        }
    },
    
    // Загрузить группы пользователя
    async loadGroups() {
        try {
            const res = await fetch(window.API_URL + '/api/groups/' + window.currentUser.id);
            const data = await res.json();
            this.groups = data.groups || [];
            console.log('[Group] Загружено групп:', this.groups.length);
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
                <div class="bg-gray-800 rounded-3xl p-6 max-w-md w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
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
                            <label class="block text-sm text-white/70 mb-2">Название группы *</label>
                            <input type="text" id="groupName" placeholder="Например: Друзья"
                                class="input-field w-full rounded-xl px-4 py-3 outline-none text-white bg-white/10 border border-white/20">
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
                            <label class="block text-sm text-white/70 mb-2">Добавить участников (опционально)</label>
                            <input type="text" id="groupMembersSearch" placeholder="Начните вводить имя..."
                                oninput="GroupManager.searchMembers()"
                                class="input-field w-full rounded-xl px-4 py-3 outline-none text-white bg-white/10 border border-white/20 mb-2">
                            <div id="groupMembersResults" class="max-h-40 overflow-y-auto bg-gray-700/50 rounded-xl"></div>
                            <div id="selectedMembers" class="flex flex-wrap gap-2 mt-2"></div>
                        </div>
                        
                        <button onclick="GroupManager.submitCreateGroup()" 
                            class="btn-primary w-full rounded-xl py-3 font-semibold text-white mt-4">
                            Создать группу
                        </button>
                        
                        <p id="groupError" class="text-red-400 text-sm text-center hidden"></p>
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
            
            if (users.length === 0) {
                resultsEl.innerHTML = '<p class="p-3 text-white/50 text-sm">Никого не найдено</p>';
                return;
            }
            
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
        this.searchMembers();
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
        const nameInput = document.getElementById('groupName');
        const name = nameInput ? nameInput.value.trim() : '';
        const typeRadio = document.querySelector('input[name="groupType"]:checked');
        const isChannel = typeRadio ? typeRadio.value === 'channel' : false;
        const errorEl = document.getElementById('groupError');
        
        if (!name) {
            if (errorEl) {
                errorEl.textContent = 'Введите название группы!';
                errorEl.classList.remove('hidden');
            }
            return;
        }
        
        const memberIds = this.selectedMembers.map(m => m.id);
        
        console.log('[Group] Отправляем создание группы:', { name, memberIds, isChannel });
        
        const group = await this.createGroup(name, memberIds, isChannel);
        
        if (group) {
            this.closeModal();
            // Показываем уведомление об успехе
            if (typeof showToast === 'function') {
                showToast('Группа "' + name + '" создана!');
            } else {
                alert('Группа "' + name + '" создана!');
            }
            // Перезагружаем список чатов
            if (typeof loadChats === 'function') {
                loadChats();
            }
        } else {
            if (errorEl) {
                errorEl.textContent = 'Ошибка создания группы. Попробуйте ещё раз.';
                errorEl.classList.remove('hidden');
            }
        }
    },
    
    // Закрыть модальное окно
    closeModal() {
        const modals = document.getElementById('modals');
        if (modals) {
            modals.innerHTML = '';
        }
        this.selectedMembers = [];
    },
    
    // === Стикеры и Эмодзи ===
    
    currentTab: 'emoji',
    
    // Показать панель эмодзи/стикеров
    showEmojiStickerPanel() {
        const settings = this.getDevSettings();
        if (!settings.emojiEnabled) return;
        
        const panel = document.getElementById('emojiStickerPanel');
        if (panel) {
            panel.classList.toggle('hidden');
        }
    },
    
    // Переключение вкладок
    switchTab(tab) {
        this.currentTab = tab;
        this.renderEmojiStickerContent();
        
        // Обновляем активные кнопки
        document.querySelectorAll('.emoji-tab-btn').forEach(btn => {
            btn.classList.remove('bg-purple-500', 'text-white');
            btn.classList.add('text-white/50');
        });
        const activeBtn = document.getElementById('tab-' + tab);
        if (activeBtn) {
            activeBtn.classList.add('bg-purple-500', 'text-white');
            activeBtn.classList.remove('text-white/50');
        }
    },
    
    // Рендер контента панели
    renderEmojiStickerContent() {
        const content = document.getElementById('emojiStickerContent');
        if (!content) return;
        
        if (this.currentTab === 'emoji') {
            const emojis = ['😀', '😂', '😍', '🥰', '😎', '🤔', '😢', '😡', '👍', '👎', '❤️', '🔥', '✨', '🎉', '👋', '🙏', '💪', '🤝', '👀', '💯', '🎵', '📷', '🎮', '💻', '🌟', '💖', '😊', '🤣', '😘', '🥺', '😭', '😤', '🙄', '😴', '🤮', '🤧', '😇', '🥳', '😈', '💀'];
            content.innerHTML = `
                <div class="grid grid-cols-8 gap-1 p-2">
                    ${emojis.map(e => `<button onclick="GroupManager.insertEmoji('${e}')" class="text-xl p-1 hover:bg-white/10 rounded transition">${e}</button>`).join('')}
                </div>
            `;
        } else {
            content.innerHTML = `
                <div class="grid grid-cols-4 gap-2 p-2">
                    ${this.stickers.map(s => {
                        if (s.emoji) {
                            return `<button onclick="GroupManager.sendSticker('${s.emoji}')" class="text-3xl p-2 hover:bg-white/10 rounded-xl transition flex items-center justify-center h-16">${s.emoji}</button>`;
                        } else {
                            return `<button onclick="GroupManager.sendSticker('${s.url}')" class="p-1 hover:bg-white/10 rounded-xl transition"><img src="${s.url}" alt="${s.name}" class="w-full h-14 object-contain" onerror="this.src='data:image/svg+xml,<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; viewBox=&quot;0 0 100 100&quot;><text y=&quot;.9em&quot; font-size=&quot;90&quot;>🖼️</text></svg>'"></button>`;
                        }
                    }).join('')}
                </div>
            `;
        }
    },
    
    // Вставить эмодзи в поле ввода
    insertEmoji(emoji) {
        const input = document.getElementById('messageInput');
        if (input) {
            input.value += emoji;
            input.focus();
        }
    },
    
    // Отправить стикер как сообщение
    async sendSticker(sticker) {
        if (!window.currentChat) return;
        
        // Определяем тип контента
        let content, type;
        if (sticker.startsWith('http')) {
            content = sticker;
            type = 'sticker';
        } else {
            content = sticker;
            type = 'text';
        }
        
        try {
            await fetch(window.API_URL + '/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: window.currentChat.id,
                    senderId: window.currentUser.id,
                    content: content,
                    type: type
                })
            });
            
            // Скрываем панель
            const panel = document.getElementById('emojiStickerPanel');
            if (panel) panel.classList.add('hidden');
        } catch (e) {
            console.error('[Group] Ошибка отправки стикера:', e);
        }
    },
    
    // Получить HTML для панели эмодзи/стикеров
    getEmojiStickerPanelHTML() {
        return `
            <div id="emojiStickerPanel" class="hidden absolute bottom-full left-0 mb-2 w-80 bg-gray-800 rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
                <!-- Вкладки -->
                <div class="flex border-b border-white/10">
                    <button id="tab-emoji" onclick="GroupManager.switchTab('emoji')" class="emoji-tab-btn flex-1 py-2 text-sm font-medium bg-purple-500 text-white transition">
                        😀 Эмодзи
                    </button>
                    <button id="tab-stickers" onclick="GroupManager.switchTab('stickers')" class="emoji-tab-btn flex-1 py-2 text-sm font-medium text-white/50 hover:text-white transition">
                        🎨 Стикеры
                    </button>
                </div>
                <!-- Контент -->
                <div id="emojiStickerContent" class="max-h-60 overflow-y-auto">
                    <!-- Заполняется динамически -->
                </div>
            </div>
        `;
    },
    
    // === Групповые звонки ===
    
    groupCallParticipants: [],
    groupCallStreams: new Map(),
    groupCallConnections: new Map(),
    
    // Начать групповой звонок
    async startGroupCall(groupId, participants, callType = 'audio') {
        console.log('[Group] Начинаем групповой звонок:', groupId, participants);
        
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
        
        const groupCallId = 'gcall_' + Date.now();
        
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
        
        this.showGroupCallUI(groupCallId, callType, participants);
    },
    
    // Показать диалог выбора участников для группового звонка
    showGroupCallDialog(preselectedUserId = null) {
        const settings = this.getDevSettings();
        
        if (!settings.groupCallsEnabled) {
            alert('Групповые звонки отключены. Включите их в меню разработчика (10 кликов на "MAX soft" в настройках).');
            return;
        }
        
        const html = `
            <div class="fixed inset-0 modal-overlay flex items-center justify-center z-50 fade-in" id="groupCallDialog">
                <div class="bg-gray-800 rounded-3xl p-6 max-w-md w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
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
                            class="input-field w-full rounded-xl px-4 py-3 outline-none text-white bg-white/10 border border-white/20">
                        
                        <div id="groupCallMembersResults" class="max-h-48 overflow-y-auto bg-gray-700/50 rounded-xl"></div>
                        <div id="groupCallSelectedMembers" class="flex flex-wrap gap-2"></div>
                        
                        <div class="flex gap-3 pt-4">
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
        
        if (preselectedUserId && window.otherUserData) {
            this.groupCallSelectedMembers.push({
                id: preselectedUserId,
                displayName: window.otherUserData.displayName || 'Собеседник'
            });
            this.updateGroupCallSelectedUI();
        }
    },
    
    groupCallSelectedMembers: [],
    
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
    
    async initiateGroupCall(callType) {
        if (this.groupCallSelectedMembers.length === 0) {
            alert('Выберите хотя бы одного участника');
            return;
        }
        
        const participants = [window.currentUser.id, ...this.groupCallSelectedMembers.map(m => m.id)];
        this.closeModal();
        
        await this.startGroupCall(null, participants, callType);
    },
    
    showGroupCallUI(groupCallId, callType, participants) {
        const participantsHtml = participants.map(p => {
            const isMe = p === window.currentUser.id;
            return `
                <div class="text-center">
                    <div class="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl font-bold mx-auto mb-1 ${isMe ? '' : 'pulse-call'}">
                        ${isMe ? '👤' : '?'}
                    </div>
                    <p class="text-xs text-white/70 truncate w-16">${isMe ? 'Вы' : 'Участник'}</p>
                </div>
            `;
        }).join('');
        
        const html = `
            <div class="fixed inset-0 modal-overlay flex items-center justify-center z-50 fade-in" id="callModal">
                <div class="bg-gray-800 rounded-3xl p-6 text-center max-w-lg w-full mx-4 shadow-2xl">
                    <div class="flex justify-between mb-4">
                        <h3 class="text-lg font-semibold">Групповой звонок</h3>
                        <button onclick="CallManager.toggleMinimize()" class="p-2 hover:bg-white/10 rounded-lg transition">
                            <svg class="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="flex justify-center gap-4 flex-wrap mb-6">
                        ${participantsHtml}
                    </div>
                    
                    <p class="text-white/50 mb-4" id="callStatus">Ожидание участников...</p>
                    <p class="text-3xl font-mono mb-6 text-purple-300" id="callTimer">00:00</p>
                    
                    <div class="flex justify-center gap-3">
                        <button id="muteBtn" onclick="CallManager.toggleMute()" 
                            class="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                            </svg>
                        </button>
                        <button onclick="GroupManager.endGroupCall()" 
                            class="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition shadow-lg shadow-red-500/30">
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
    },
    
    endGroupCall() {
        this.groupCallConnections.forEach(pc => pc.close());
        this.groupCallConnections.clear();
        this.groupCallStreams.clear();
        this.groupCallParticipants = [];
        CallManager.cleanup();
    },
    
    // === Настройки разработчика ===
    
    devClickCount: 0,
    devClickTimeout: null,
    
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
                                <p class="font-medium">Эмодзи и Стикеры</p>
                                <p class="text-sm text-white/50">Кнопка рядом с полем ввода</p>
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
                                <p class="text-sm text-white/50">В обычных чатах</p>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="devGroupCallsEnabled" ${settings.groupCallsEnabled ? 'checked' : ''} 
                                    onchange="GroupManager.saveDevSettings()" class="sr-only peer">
                                <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                            </label>
                        </div>
                        
                        <div class="mt-6 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-xl">
                            <p class="text-yellow-300 text-sm text-center">⚠️ Экспериментальные функции</p>
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
    
    saveDevSettings() {
        const settings = {
            emojiEnabled: document.getElementById('devEmojiEnabled')?.checked || false,
            groupCallsEnabled: document.getElementById('devGroupCallsEnabled')?.checked || false
        };
        
        localStorage.setItem('maxutra_dev_settings', JSON.stringify(settings));
        console.log('[Group] Настройки сохранены:', settings);
        
        // Обновляем UI
        if (typeof renderMainApp === 'function') {
            this.closeModal();
            renderMainApp();
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
