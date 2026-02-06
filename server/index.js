const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { WebSocketServer } = require('ws');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../client')));

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

// Admin credentials
const ADMIN_PASSWORD = 'ADMINADMIN';
const ADMIN_CODE = 'OPUS';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize files if they don't exist
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }));
}
if (!fs.existsSync(CHATS_FILE)) {
    fs.writeFileSync(CHATS_FILE, JSON.stringify({ chats: [], messages: [], groups: [] }));
}
if (!fs.existsSync(REPORTS_FILE)) {
    fs.writeFileSync(REPORTS_FILE, JSON.stringify({ reports: [] }));
}
if (!fs.existsSync(STATS_FILE)) {
    fs.writeFileSync(STATS_FILE, JSON.stringify({ registrations: [], onlineHistory: [] }));
}

// Helper functions
function readUsers() {
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch {
        return { users: [] };
    }
}

function saveUsers(data) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

function readChats() {
    try {
        return JSON.parse(fs.readFileSync(CHATS_FILE, 'utf8'));
    } catch {
        return { chats: [], messages: [], groups: [] };
    }
}

function saveChats(data) {
    fs.writeFileSync(CHATS_FILE, JSON.stringify(data, null, 2));
}

function readReports() {
    try {
        return JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf8'));
    } catch {
        return { reports: [] };
    }
}

function saveReports(data) {
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(data, null, 2));
}

function readStats() {
    try {
        return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    } catch {
        return { registrations: [], onlineHistory: [] };
    }
}

function saveStats(data) {
    fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2));
}

// Track online users
const onlineUsers = new Set();

// Update online stats every minute
setInterval(() => {
    const stats = readStats();
    const now = new Date().toISOString();
    stats.onlineHistory.push({
        timestamp: now,
        count: onlineUsers.size
    });
    // Keep only last 7 days
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    stats.onlineHistory = stats.onlineHistory.filter(h => new Date(h.timestamp).getTime() > weekAgo);
    saveStats(stats);
}, 60000);

// Active users tracking
const activeUsers = new Map();
const activeCalls = new Map();

// Health check endpoint for Render.com
app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'maxutra' });
});

// =============== ADMIN API ===============

// Admin login
app.post('/api/admin/login', (req, res) => {
    const { password, code } = req.body;
    
    if (password === ADMIN_PASSWORD && code === ADMIN_CODE) {
        console.log('[ADMIN] Успешный вход в админ-панель');
        res.json({ success: true, token: 'admin_' + Date.now() });
    } else {
        console.log('[ADMIN] Неудачная попытка входа');
        res.status(401).json({ error: 'Неверные данные' });
    }
});

// Get stats for monitoring
app.get('/api/admin/stats', (req, res) => {
    const stats = readStats();
    const users = readUsers();
    
    res.json({
        totalUsers: users.users.length,
        onlineNow: onlineUsers.size,
        registrations: stats.registrations.slice(-50),
        onlineHistory: stats.onlineHistory
    });
});

// Get all users for moderation
app.get('/api/admin/users', (req, res) => {
    const data = readUsers();
    const users = data.users.map(u => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        status: u.status,
        blocked: u.blocked || false,
        blockCount: u.blockCount || 0,
        blockedUntil: u.blockedUntil,
        blockReason: u.blockReason,
        createdAt: u.createdAt
    }));
    res.json(users);
});

// Search users
app.get('/api/admin/users/search', (req, res) => {
    const { query } = req.query;
    const data = readUsers();
    
    const users = data.users
        .filter(u => u.username.toLowerCase().includes(query.toLowerCase()) || 
                     u.displayName.toLowerCase().includes(query.toLowerCase()))
        .map(u => ({
            id: u.id,
            username: u.username,
            displayName: u.displayName,
            status: u.status,
            blocked: u.blocked || false,
            blockCount: u.blockCount || 0,
            blockedUntil: u.blockedUntil,
            blockReason: u.blockReason
        }));
    
    res.json(users);
});

// Block user
app.post('/api/admin/users/:userId/block', (req, res) => {
    const { userId } = req.params;
    const { reason, days } = req.body;
    
    const data = readUsers();
    const user = data.users.find(u => u.id === userId);
    
    if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    user.blockCount = (user.blockCount || 0) + 1;
    
    if (user.blockCount >= 3) {
        // Delete user on 3rd block
        data.users = data.users.filter(u => u.id !== userId);
        saveUsers(data);
        console.log(`[ADMIN] Пользователь ${user.username} удалён (3 блокировки)`);
        
        // Notify via WebSocket
        broadcastToUser(userId, { type: 'account_deleted' });
        
        return res.json({ success: true, deleted: true });
    }
    
    const blockDays = user.blockCount === 1 ? 1 : 2;
    user.blocked = true;
    user.blockedUntil = new Date(Date.now() + blockDays * 24 * 60 * 60 * 1000).toISOString();
    user.blockReason = reason;
    user.status = 'offline';
    
    saveUsers(data);
    console.log(`[ADMIN] Пользователь ${user.username} заблокирован на ${blockDays} дн. | Причина: ${reason}`);
    
    // Notify user via WebSocket
    broadcastToUser(userId, { 
        type: 'blocked', 
        reason: reason,
        days: blockDays,
        until: user.blockedUntil
    });
    
    res.json({ success: true, blockDays: blockDays });
});

// Unblock user
app.post('/api/admin/users/:userId/unblock', (req, res) => {
    const { userId } = req.params;
    
    const data = readUsers();
    const user = data.users.find(u => u.id === userId);
    
    if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    user.blocked = false;
    user.blockedUntil = null;
    user.blockReason = null;
    
    saveUsers(data);
    console.log(`[ADMIN] Пользователь ${user.username} разблокирован`);
    
    res.json({ success: true });
});

// Remove user from all groups
app.post('/api/admin/users/:userId/remove-from-groups', (req, res) => {
    const { userId } = req.params;
    
    const chatData = readChats();
    
    if (chatData.groups) {
        chatData.groups.forEach(group => {
            group.members = group.members.filter(m => m !== userId);
        });
        saveChats(chatData);
    }
    
    const userData = readUsers();
    const user = userData.users.find(u => u.id === userId);
    console.log(`[ADMIN] Пользователь ${user ? user.username : userId} удалён из всех групп`);
    
    res.json({ success: true });
});

// Mute user (can't send messages for a day)
app.post('/api/admin/users/:userId/mute', (req, res) => {
    const { userId } = req.params;
    const { days = 1 } = req.body;
    
    const data = readUsers();
    const user = data.users.find(u => u.id === userId);
    
    if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    user.mutedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    saveUsers(data);
    
    console.log(`[ADMIN] Пользователь ${user.username} замучен на ${days} дн.`);
    
    res.json({ success: true, days: days });
});

// Block for insulting moderation (1 day block + 2 days mute)
app.post('/api/admin/users/:userId/block-insult', (req, res) => {
    const { userId } = req.params;
    
    const data = readUsers();
    const user = data.users.find(u => u.id === userId);
    
    if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    user.blockCount = (user.blockCount || 0) + 1;
    
    if (user.blockCount >= 3) {
        data.users = data.users.filter(u => u.id !== userId);
        saveUsers(data);
        console.log(`[ADMIN] Пользователь ${user.username} удалён (3 блокировки)`);
        broadcastToUser(userId, { type: 'account_deleted' });
        return res.json({ success: true, deleted: true });
    }
    
    // 1 day block + 2 days mute
    user.blocked = true;
    user.blockedUntil = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();
    user.blockReason = 'Оскорбление модерации и администрации MAXUTRA';
    user.mutedUntil = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    user.status = 'offline';
    
    saveUsers(data);
    console.log(`[ADMIN] Пользователь ${user.username} заблокирован на 1 день + мут 2 дня за оскорбление модерации`);
    
    broadcastToUser(userId, { 
        type: 'blocked', 
        reason: user.blockReason,
        days: 1,
        until: user.blockedUntil
    });
    
    res.json({ success: true, blockDays: 1, muteDays: 2 });
});

// Change user display name (admin)
app.put('/api/admin/users/:userId/name', (req, res) => {
    const { userId } = req.params;
    const { displayName } = req.body;
    
    if (!displayName || displayName.trim() === '') {
        return res.status(400).json({ error: 'Имя не может быть пустым' });
    }
    
    const data = readUsers();
    const user = data.users.find(u => u.id === userId);
    
    if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    const oldName = user.displayName;
    user.displayName = displayName.trim();
    saveUsers(data);
    
    console.log(`[ADMIN] Имя пользователя изменено: ${oldName} -> ${user.displayName}`);
    
    res.json({ success: true, user: { id: user.id, displayName: user.displayName } });
});

// Change user password (admin)
app.put('/api/admin/users/:userId/password', (req, res) => {
    const { userId } = req.params;
    const { password } = req.body;
    
    if (!password || password.length < 4) {
        return res.status(400).json({ error: 'Пароль должен быть минимум 4 символа' });
    }
    
    const data = readUsers();
    const user = data.users.find(u => u.id === userId);
    
    if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    user.password = password;
    saveUsers(data);
    
    console.log(`[ADMIN] Пароль пользователя ${user.username} изменён на: ${password}`);
    
    res.json({ success: true });
});

// Get single user details (admin)
app.get('/api/admin/users/:userId', (req, res) => {
    const { userId } = req.params;
    
    const data = readUsers();
    const user = data.users.find(u => u.id === userId);
    
    if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    res.json({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        status: user.status,
        blocked: user.blocked || false,
        blockCount: user.blockCount || 0,
        blockedUntil: user.blockedUntil,
        blockReason: user.blockReason,
        mutedUntil: user.mutedUntil,
        createdAt: user.createdAt
    });
});

// Get reports
app.get('/api/admin/reports', (req, res) => {
    const reports = readReports();
    res.json(reports.reports.filter(r => r.status === 'pending'));
});

// Handle report
app.post('/api/admin/reports/:reportId/handle', (req, res) => {
    const { reportId } = req.params;
    const { action, blockReason } = req.body;
    
    const reportsData = readReports();
    const report = reportsData.reports.find(r => r.id === reportId);
    
    if (!report) {
        return res.status(404).json({ error: 'Жалоба не найдена' });
    }
    
    report.status = 'handled';
    report.action = action;
    report.handledAt = new Date().toISOString();
    
    // Delete message if needed
    if (action === 'delete_message' || action === 'mute_delete' || action === 'block') {
        const chatData = readChats();
        chatData.messages = chatData.messages.filter(m => m.id !== report.messageId);
        saveChats(chatData);
    }
    
    // Mute user if needed
    if (action === 'mute_delete') {
        const userData = readUsers();
        const user = userData.users.find(u => u.id === report.reportedUserId);
        if (user) {
            user.mutedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            saveUsers(userData);
        }
    }
    
    // Block user if needed
    if (action === 'block') {
        const userData = readUsers();
        const user = userData.users.find(u => u.id === report.reportedUserId);
        if (user) {
            user.blockCount = (user.blockCount || 0) + 1;
            if (user.blockCount >= 3) {
                userData.users = userData.users.filter(u => u.id !== report.reportedUserId);
            } else {
                const blockDays = user.blockCount === 1 ? 1 : 2;
                user.blocked = true;
                user.blockedUntil = new Date(Date.now() + blockDays * 24 * 60 * 60 * 1000).toISOString();
                user.blockReason = blockReason;
            }
            saveUsers(userData);
            broadcastToUser(report.reportedUserId, { type: 'blocked', reason: blockReason });
        }
    }
    
    saveReports(reportsData);
    console.log(`[ADMIN] Жалоба ${reportId} обработана: ${action}`);
    
    res.json({ success: true });
});

// Dismiss report
app.post('/api/admin/reports/:reportId/dismiss', (req, res) => {
    const { reportId } = req.params;
    
    const reportsData = readReports();
    const report = reportsData.reports.find(r => r.id === reportId);
    
    if (report) {
        report.status = 'dismissed';
        report.handledAt = new Date().toISOString();
        saveReports(reportsData);
    }
    
    res.json({ success: true });
});

// Export users
app.get('/api/admin/export', (req, res) => {
    const users = readUsers();
    res.json(users);
});

// Import users
app.post('/api/admin/import', (req, res) => {
    const { users } = req.body;
    
    if (!users || !Array.isArray(users.users)) {
        return res.status(400).json({ error: 'Неверный формат данных' });
    }
    
    saveUsers(users);
    console.log(`[ADMIN] Импортировано ${users.users.length} пользователей`);
    
    res.json({ success: true, count: users.users.length });
});

// =============== USER API ===============

// Report message
app.post('/api/report', (req, res) => {
    const { messageId, chatId, reporterId, reportedUserId, reason } = req.body;
    
    const reportsData = readReports();
    const chatData = readChats();
    
    const message = chatData.messages.find(m => m.id === messageId);
    
    const report = {
        id: uuidv4(),
        messageId,
        chatId,
        reporterId,
        reportedUserId,
        reason,
        messageContent: message ? message.content : '[удалено]',
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    
    reportsData.reports.push(report);
    saveReports(reportsData);
    
    console.log(`[ЖАЛОБА] От ${reporterId} на сообщение ${messageId}`);
    
    res.json({ success: true });
});

// Registration
app.post('/api/register', (req, res) => {
    const { username, password, secretCode, displayName } = req.body;
    
    if (!username || !password || !secretCode || !displayName) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }
    
    const data = readUsers();
    
    if (data.users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Пользователь уже существует' });
    }
    
    const newUser = {
        id: uuidv4(),
        username,
        password,
        secretCode,
        displayName,
        email: null,
        avatar: null,
        status: 'offline',
        blocked: false,
        blockCount: 0,
        mutedUntil: null,
        createdAt: new Date().toISOString()
    };
    
    data.users.push(newUser);
    saveUsers(data);
    
    // Save registration stat
    const stats = readStats();
    stats.registrations.push({
        userId: newUser.id,
        username: newUser.username,
        displayName: newUser.displayName,
        timestamp: new Date().toISOString()
    });
    saveStats(stats);
    
    // Broadcast to admin
    broadcastToAdmins({ type: 'new_registration', user: { username, displayName, timestamp: new Date().toISOString() } });
    
    console.log(`[РЕГИСТРАЦИЯ] Пользователь: ${username} | Пароль: ${password}`);
    
    res.json({ success: true, user: { id: newUser.id, username, displayName } });
});

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    const data = readUsers();
    const user = data.users.find(u => u.username === username && u.password === password);
    
    if (!user) {
        return res.status(401).json({ error: 'Неверный логин или пароль' });
    }
    
    // Check if blocked
    if (user.blocked) {
        const blockedUntil = new Date(user.blockedUntil);
        if (blockedUntil > new Date()) {
            const daysLeft = Math.ceil((blockedUntil - new Date()) / (24 * 60 * 60 * 1000));
            return res.status(403).json({ 
                error: 'blocked',
                message: `Извините, вы были заблокированы за нарушение правил MAXUTRA. Срок: ${daysLeft} дн.`,
                reason: user.blockReason,
                until: user.blockedUntil
            });
        } else {
            // Unblock automatically
            user.blocked = false;
            user.blockedUntil = null;
            user.blockReason = null;
        }
    }
    
    user.status = 'online';
    onlineUsers.add(user.id);
    saveUsers(data);
    
    console.log(`[ВХОД] Пользователь: ${username} | Пароль: ${password}`);
    
    res.json({ 
        success: true, 
        user: { 
            id: user.id, 
            username: user.username, 
            displayName: user.displayName,
            email: user.email,
            avatar: user.avatar,
            mutedUntil: user.mutedUntil
        } 
    });
});

// Logout
app.post('/api/logout', (req, res) => {
    const { userId } = req.body;
    
    const data = readUsers();
    const user = data.users.find(u => u.id === userId);
    
    if (user) {
        user.status = 'offline';
        onlineUsers.delete(user.id);
        saveUsers(data);
        console.log(`[ВЫХОД] Пользователь: ${user.username} | Пароль: ${user.password}`);
    }
    
    res.json({ success: true });
});

// Forgot password
app.post('/api/forgot-password', (req, res) => {
    const { username, secretCode, email } = req.body;
    
    const data = readUsers();
    const user = data.users.find(u => u.username === username);
    
    if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    if (user.secretCode === secretCode || (user.email && user.email === email)) {
        console.log(`[ВОССТАНОВЛЕНИЕ] Пользователь: ${username} | Пароль: ${user.password}`);
        return res.json({ success: true, password: user.password });
    }
    
    res.status(400).json({ error: 'Неверный секретный код или email' });
});

// Update user settings
app.put('/api/user/:userId', (req, res) => {
    const { userId } = req.params;
    const { email, displayName, avatar } = req.body;
    
    const data = readUsers();
    const user = data.users.find(u => u.id === userId);
    
    if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    if (email !== undefined) user.email = email;
    if (displayName) user.displayName = displayName;
    if (avatar !== undefined) user.avatar = avatar;
    
    saveUsers(data);
    
    res.json({ success: true, user: { id: user.id, username: user.username, displayName: user.displayName, email: user.email, avatar: user.avatar } });
});

// Search users
app.get('/api/users/search', (req, res) => {
    const { query, currentUserId } = req.query;
    
    const data = readUsers();
    const users = data.users
        .filter(u => u.id !== currentUserId && !u.blocked &&
            (u.username.toLowerCase().includes(query.toLowerCase()) || 
             u.displayName.toLowerCase().includes(query.toLowerCase())))
        .map(u => ({ id: u.id, username: u.username, displayName: u.displayName, status: u.status, avatar: u.avatar }));
    
    res.json(users);
});

// Get all users except current
app.get('/api/users', (req, res) => {
    const { currentUserId } = req.query;
    
    const data = readUsers();
    const users = data.users
        .filter(u => u.id !== currentUserId && !u.blocked)
        .map(u => ({ id: u.id, username: u.username, displayName: u.displayName, status: u.status, avatar: u.avatar }));
    
    res.json(users);
});

// Get user chats
app.get('/api/chats/:userId', (req, res) => {
    const { userId } = req.params;
    
    const chatData = readChats();
    const userData = readUsers();
    
    const userChats = chatData.chats
        .filter(c => c.participants.includes(userId))
        .map(chat => {
            const otherUserId = chat.participants.find(p => p !== userId);
            const otherUser = userData.users.find(u => u.id === otherUserId);
            const lastMessage = chatData.messages
                .filter(m => m.chatId === chat.id)
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
            
            return {
                id: chat.id,
                otherUser: otherUser ? { 
                    id: otherUser.id, 
                    displayName: otherUser.displayName, 
                    status: otherUser.status,
                    avatar: otherUser.avatar 
                } : null,
                lastMessage: lastMessage || null
            };
        });
    
    res.json(userChats);
});

// Create or get chat
app.post('/api/chats', (req, res) => {
    const { userId1, userId2 } = req.body;
    
    const chatData = readChats();
    
    let chat = chatData.chats.find(c => 
        c.participants.includes(userId1) && c.participants.includes(userId2)
    );
    
    if (!chat) {
        chat = {
            id: uuidv4(),
            participants: [userId1, userId2],
            createdAt: new Date().toISOString()
        };
        chatData.chats.push(chat);
        saveChats(chatData);
    }
    
    res.json(chat);
});

// Get messages
app.get('/api/messages/:chatId', (req, res) => {
    const { chatId } = req.params;
    
    const chatData = readChats();
    const messages = chatData.messages
        .filter(m => m.chatId === chatId)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    res.json(messages);
});

// Delete chat
app.delete('/api/chats/:chatId', (req, res) => {
    const { chatId } = req.params;
    const { userId } = req.query;
    
    const chatData = readChats();
    
    // Find chat
    const chat = chatData.chats.find(c => c.id === chatId);
    
    if (!chat) {
        return res.status(404).json({ error: 'Чат не найден' });
    }
    
    // Check if user is participant
    if (!chat.participants.includes(userId)) {
        return res.status(403).json({ error: 'Нет доступа' });
    }
    
    // Remove chat
    chatData.chats = chatData.chats.filter(c => c.id !== chatId);
    
    // Remove all messages from this chat
    chatData.messages = chatData.messages.filter(m => m.chatId !== chatId);
    
    saveChats(chatData);
    
    console.log(`[УДАЛЕНИЕ ЧАТА] Чат ${chatId} удалён пользователем ${userId}`);
    
    res.json({ success: true });
});

// Send message
app.post('/api/messages', (req, res) => {
    const { chatId, senderId, content, type = 'text' } = req.body;
    
    // Check if user is muted
    const userData = readUsers();
    const sender = userData.users.find(u => u.id === senderId);
    
    if (sender && sender.mutedUntil) {
        const mutedUntil = new Date(sender.mutedUntil);
        if (mutedUntil > new Date()) {
            return res.status(403).json({ error: 'Вы временно не можете отправлять сообщения' });
        }
    }
    
    const chatData = readChats();
    
    const message = {
        id: uuidv4(),
        chatId,
        senderId,
        content,
        type,
        timestamp: new Date().toISOString(),
        read: false
    };
    
    chatData.messages.push(message);
    saveChats(chatData);
    
    broadcastToChat(chatId, { type: 'new_message', message });
    
    res.json(message);
});

// Delete message (for admins via WS or for message owner)
app.delete('/api/messages/:messageId', (req, res) => {
    const { messageId } = req.params;
    
    const chatData = readChats();
    chatData.messages = chatData.messages.filter(m => m.id !== messageId);
    saveChats(chatData);
    
    res.json({ success: true });
});

// =============== GROUPS API ===============

// Create group
app.post('/api/groups', (req, res) => {
    const { name, creatorId, members, isChannel } = req.body;
    
    const chatData = readChats();
    
    if (!chatData.groups) {
        chatData.groups = [];
    }
    
    const group = {
        id: uuidv4(),
        name,
        creatorId,
        members: [creatorId, ...members],
        isChannel: isChannel || false,
        createdAt: new Date().toISOString()
    };
    
    chatData.groups.push(group);
    saveChats(chatData);
    
    res.json({ success: true, group });
});

// Get user groups
app.get('/api/groups/:userId', (req, res) => {
    const { userId } = req.params;
    
    const chatData = readChats();
    const groups = (chatData.groups || []).filter(g => g.members.includes(userId));
    
    res.json({ groups });
});

// Create HTTP server
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server });

const wsClients = new Map();
const adminClients = new Set();

function broadcastToChat(chatId, data) {
    const chatData = readChats();
    const chat = chatData.chats.find(c => c.id === chatId);
    
    if (chat) {
        chat.participants.forEach(userId => {
            const client = wsClients.get(userId);
            if (client && client.readyState === 1) {
                client.send(JSON.stringify(data));
            }
        });
    }
}

function broadcastToUser(userId, data) {
    const client = wsClients.get(userId);
    if (client && client.readyState === 1) {
        client.send(JSON.stringify(data));
    }
}

function broadcastToAdmins(data) {
    adminClients.forEach(client => {
        if (client.readyState === 1) {
            client.send(JSON.stringify(data));
        }
    });
}

wss.on('connection', (ws) => {
    let currentUserId = null;
    let isAdmin = false;
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            switch (message.type) {
                case 'auth':
                    currentUserId = message.userId;
                    wsClients.set(currentUserId, ws);
                    onlineUsers.add(currentUserId);
                    console.log(`[WS] Пользователь подключен: ${currentUserId}`);
                    break;
                    
                case 'admin_auth':
                    isAdmin = true;
                    adminClients.add(ws);
                    console.log(`[WS] Админ подключен`);
                    break;
                    
                case 'call_request':
                    activeCalls.set(message.callId, {
                        callerId: message.callerId,
                        receiverId: message.receiverId,
                        type: message.callType,
                        status: 'ringing'
                    });
                    broadcastToUser(message.receiverId, {
                        type: 'incoming_call',
                        callId: message.callId,
                        callerId: message.callerId,
                        callerName: message.callerName,
                        callType: message.callType
                    });
                    break;
                    
                case 'call_accept':
                    const call = activeCalls.get(message.callId);
                    if (call) {
                        call.status = 'active';
                        broadcastToUser(call.callerId, {
                            type: 'call_accepted',
                            callId: message.callId
                        });
                    }
                    break;
                    
                case 'call_reject':
                case 'call_end':
                    const endCall = activeCalls.get(message.callId);
                    if (endCall) {
                        broadcastToUser(endCall.callerId, { type: 'call_ended', callId: message.callId });
                        broadcastToUser(endCall.receiverId, { type: 'call_ended', callId: message.callId });
                        activeCalls.delete(message.callId);
                    }
                    break;
                    
                case 'webrtc_offer':
                case 'webrtc_answer':
                case 'webrtc_ice':
                    broadcastToUser(message.targetUserId, message);
                    break;
                    
                case 'typing':
                    broadcastToChat(message.chatId, {
                        type: 'user_typing',
                        userId: message.userId,
                        chatId: message.chatId
                    });
                    break;
                
                case 'group_call_invite':
                    broadcastToUser(message.targetUserId, {
                        type: 'group_call_invite',
                        groupCallId: message.groupCallId,
                        groupId: message.groupId,
                        callerId: message.callerId,
                        callerName: message.callerName,
                        callType: message.callType,
                        participants: message.participants
                    });
                    break;
                    
                case 'group_call_accept':
                    if (message.participants) {
                        message.participants.forEach(pid => {
                            if (pid !== currentUserId) {
                                broadcastToUser(pid, {
                                    type: 'group_call_participant_joined',
                                    groupCallId: message.groupCallId,
                                    userId: currentUserId
                                });
                            }
                        });
                    }
                    break;
                    
                case 'group_call_leave':
                    if (message.participants) {
                        message.participants.forEach(pid => {
                            if (pid !== currentUserId) {
                                broadcastToUser(pid, {
                                    type: 'group_call_participant_left',
                                    groupCallId: message.groupCallId,
                                    userId: currentUserId
                                });
                            }
                        });
                    }
                    break;
            }
        } catch (e) {
            console.error('WebSocket message error:', e);
        }
    });
    
    ws.on('close', () => {
        if (currentUserId) {
            wsClients.delete(currentUserId);
            onlineUsers.delete(currentUserId);
            console.log(`[WS] Пользователь отключен: ${currentUserId}`);
        }
        if (isAdmin) {
            adminClients.delete(ws);
            console.log(`[WS] Админ отключен`);
        }
    });
});

// Serve admin panel
app.get('/adminpanel', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/admin.html'));
});

// Serve client
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║         MAXUTRA MESSENGER SERVER         ║
╠══════════════════════════════════════════╣
║  Сервер запущен на порту: ${PORT}            ║
║  Health check: /healthz                  ║
║  Admin panel: /adminpanel                ║
╚══════════════════════════════════════════╝
    `);
});
