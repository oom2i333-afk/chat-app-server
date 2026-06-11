const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL || '*';

// ─── 数据存储 ───────────────────────────────────────────
const users = new Map();        // userId -> { id, name, avatar, online, socketId }
const messages = new Map();     // chatId -> [ message... ]
// chatId 格式: 两个 userId 排序后用 ":" 连接

// ─── 静态文件 ───────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── 工具函数 ───────────────────────────────────────────
function getChatId(user1, user2) {
  return [user1, user2].sort().join(':');
}

function formatMessage(msg) {
  return {
    id: msg.id,
    from: msg.from,
    to: msg.to,
    text: msg.text,
    time: msg.time,
  };
}

function getAvatar(name) {
  const colors = [
    '#e74c3c','#e67e22','#f1c40f','#2ecc71',
    '#1abc9c','#3498db','#9b59b6','#34495e'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return {
    name: name.charAt(0).toUpperCase(),
    color: colors[Math.abs(hash) % colors.length],
  };
}

// ─── Socket.io 事件处理 ────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[连接] ${socket.id}`);

  // ─── 用户登录 ──────────────────────────────────────────
  socket.on('user-login', (username, callback) => {
    // 检查用户名是否已在线
    for (const [id, user] of users) {
      if (user.name === username && user.online) {
        callback({ success: false, error: '该用户名已在线' });
        return;
      }
    }

    const userId = username.toLowerCase();
    const avatar = getAvatar(username);

    // 如果之前注册过，更新状态
    if (users.has(userId)) {
      const user = users.get(userId);
      user.online = true;
      user.socketId = socket.id;
      user.avatar = avatar;
    } else {
      users.set(userId, {
        id: userId,
        name: username,
        avatar,
        online: true,
        socketId: socket.id,
      });
    }

    socket.userId = userId;
    socket.join(userId);
    socket.username = username;

    // 获取在线用户列表（排除自己）
    const userList = [];
    for (const [id, user] of users) {
      if (id !== userId && user.online) {
        userList.push({
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          online: user.online,
        });
      }
    }

    // 获取聊天列表
    const chatList = getChatListForUser(userId);

    callback({
      success: true,
      user: { id: userId, name: username, avatar },
      users: userList,
      chats: chatList,
    });

    // 广播上线通知（排除自己）
    socket.broadcast.emit('user-online', {
      id: userId,
      name: username,
      avatar,
    });

    console.log(`[登录] ${username} (${userId})`);
  });

  // ─── 搜索用户 ──────────────────────────────────────────
  socket.on('search-users', (query, callback) => {
    const results = [];
    const q = query.toLowerCase().trim();
    if (!q) { callback([]); return; }
    for (const [id, user] of users) {
      if (user.name.toLowerCase().includes(q) && id !== socket.userId) {
        results.push({ id: user.id, name: user.name, avatar: user.avatar, online: user.online });
      }
    }
    callback(results);
  });

  // ─── 发送消息 ──────────────────────────────────────────
  socket.on('send-message', ({ to, text }, callback) => {
    const from = socket.userId;
    if (!from || !to || !text.trim()) return;

    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      from,
      to,
      text: text.trim(),
      time: Date.now(),
    };

    const chatId = getChatId(from, to);
    if (!messages.has(chatId)) messages.set(chatId, []);
    messages.get(chatId).push(msg);

    // 保持最多 200 条消息
    if (messages.get(chatId).length > 200) {
      messages.set(chatId, messages.get(chatId).slice(-200));
    }

    // 发送给对方
    const targetSocketId = users.get(to)?.socketId;
    if (targetSocketId) {
      io.to(to).emit('new-message', formatMessage(msg));
    }

    // 回执给发送者
    callback(formatMessage(msg));

    console.log(`[消息] ${from} → ${to}: ${msg.text.slice(0, 30)}`);
  });

  // ─── 获取聊天记录 ──────────────────────────────────────
  socket.on('get-messages', ({ with: userId }, callback) => {
    const chatId = getChatId(socket.userId, userId);
    const msgs = messages.get(chatId) || [];
    callback(msgs.map(formatMessage));
  });

  // ─── 获取未读消息 ──────────────────────────────────────
  socket.on('get-unread', (callback) => {
    const unread = [];
    const userId = socket.userId;
    for (const [chatId, msgs] of messages) {
      const parts = chatId.split(':');
      const otherId = parts[0] === userId ? parts[1] : parts[0];
      const unreadCount = msgs.filter(m => m.to === userId).length;
      // 简化处理：所有发给自己的消息都算未读（实际应用需要已读标记）
    }
    callback([]);
  });

  // ─── 输入状态 ──────────────────────────────────────────
  socket.on('typing', ({ to }) => {
    io.to(to).emit('user-typing', { from: socket.userId, name: socket.username });
  });

  socket.on('stop-typing', ({ to }) => {
    io.to(to).emit('user-stop-typing', { from: socket.userId });
  });

  // ─── 断线 ──────────────────────────────────────────────
  socket.on('disconnect', () => {
    if (socket.userId) {
      const user = users.get(socket.userId);
      if (user) user.online = false;
      socket.broadcast.emit('user-offline', { id: socket.userId });
      console.log(`[离线] ${socket.username || socket.userId}`);
    }
  });
});

// ─── 获取用户的聊天列表 ─────────────────────────────────
function getChatListForUser(userId) {
  const chatList = [];
  const seen = new Set();

  for (const [chatId, msgs] of messages) {
    const parts = chatId.split(':');
    if (parts[0] === userId || parts[1] === userId) {
      const otherId = parts[0] === userId ? parts[1] : parts[0];
      if (seen.has(otherId)) continue;
      seen.add(otherId);

      const otherUser = users.get(otherId);
      if (!otherUser) continue;

      const lastMsg = msgs[msgs.length - 1];
      const unread = msgs.filter(m => m.to === userId && !m.read).length;

      chatList.push({
        with: { id: otherId, name: otherUser.name, avatar: otherUser.avatar, online: otherUser.online },
        lastMessage: lastMsg ? { text: lastMsg.text, time: lastMsg.time } : null,
        unread,
      });
    }
  }

  // 按最新消息时间排序
  chatList.sort((a, b) => {
    const ta = a.lastMessage?.time || 0;
    const tb = b.lastMessage?.time || 0;
    return tb - ta;
  });

  return chatList;
}

// ─── 启动服务器 ─────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  💬 聊天服务器已启动`);
  console.log(`  📍 http://localhost:${PORT}`);
  console.log(`  🌐 局域网: http://${getLocalIP()}:${PORT}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
});

function getLocalIP() {
  const nets = require('os').networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}
