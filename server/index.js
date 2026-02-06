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
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize files if they don't exist
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }));
}
if (!fs.existsSync(CHATS_FILE)) {
    fs.writeFileSync(CHATS_FILE, JSON.stringify({ chats: [], messages: [] }));
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
        return { chats: [], messages: [] };
    }
}

function saveChats(data) {
    fs.writeFileSync(CHATS_FILE, JSON.stringify(data, null, 2));
}

// Active users tracking
const activeUsers = new Map();
const activeCalls = new Map();

// Health check endpoint for Render.com
app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'maxutra' });
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
        createdAt: new Date().toISOString()
    };
    
    data.users.push(newUser);
    saveUsers(data);
    
    // Log registration with password
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
    
    user.status = 'online';
    saveUsers(data);
    
    console.log(`[ВХОД] Пользователь: ${username} | Пароль: ${password}`);
    
    res.json({ 
        success: true, 
        user: { 
            id: user.id, 
            username: user.username, 
            displayName: user.displayName,
            email: user.email,
            avatar: user.avatar
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
    
    // Check secret code or email
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
        .filter(u => u.id !== currentUserId && 
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
        .filter(u => u.id !== currentUserId)
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
    
    // Check if chat exists
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

// Send message
app.post('/api/messages', (req, res) => {
    const { chatId, senderId, content, type = 'text' } = req.body;
    
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
    
    // Broadcast to WebSocket clients
    broadcastToChat(chatId, { type: 'new_message', message });
    
    res.json(message);
});

// Create HTTP server
const server = http.createServer(app);

// WebSocket server for real-time features
const wss = new WebSocketServer({ server });

const wsClients = new Map();

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

wss.on('connection', (ws) => {
    let currentUserId = null;
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            switch (message.type) {
                case 'auth':
                    currentUserId = message.userId;
                    wsClients.set(currentUserId, ws);
                    console.log(`[WS] Пользователь подключен: ${currentUserId}`);
                    break;
                    
                case 'call_request':
                    // Initiate call
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
            }
        } catch (e) {
            console.error('WebSocket message error:', e);
        }
    });
    
    ws.on('close', () => {
        if (currentUserId) {
            wsClients.delete(currentUserId);
            console.log(`[WS] Пользователь отключен: ${currentUserId}`);
        }
    });
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
╚══════════════════════════════════════════╝
    `);
});
