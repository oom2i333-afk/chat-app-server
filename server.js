const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const PORT = process.env.PORT || 3000;

// ─── 静态文件 ──────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── 头像上传配置 ──────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads', 'avatars');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `avatar_${Date.now()}_${Math.random().toString(36).slice(2, 6)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, ok.includes(file.mimetype));
  },
});

// ─── 管理员配置 ────────────────────────────────────────────
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin888';
const adminTokens = new Set();

app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ─── 管理员鉴权中间件 ──────────────────────────────────────
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token && adminTokens.has(token)) return next();
  res.status(401).json({ success: false, error: '未授权，请重新登录' });
}

// ─── 管理员登录 ────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = crypto.randomBytes(32).toString('hex');
    adminTokens.add(token);
    return res.json({ success: true, token, admin: { username: ADMIN_USER } });
  }
  res.json({ success: false, error: '管理员账号或密码错误' });
});

// ─── 管理员：获取所有用户 ──────────────────────────────────
app.get('/api/admin/users', adminAuth, (req, res) => {
  const userList = [];
  for (const [, u] of users) {
    userList.push({
      id: u.id, name: u.name, phone: u.phone,
      avatar: u.avatar, avatarColor: u.avatarColor, avatarChar: u.avatarChar,
      realName: u.realName || '', idCard: u.idCard || '',
      realNameVerified: u.realNameVerified || false,
      verificationStatus: u.verificationStatus || 'none',
      status: u.status || 'active',
      online: u.online || false,
      balance: u.balance || 0,
      createdAt: u.createdAt || 0,
    });
  }
  userList.sort((a, b) => b.createdAt - a.createdAt);

  const stats = {
    total: userList.length,
    online: userList.filter(u => u.online).length,
    verified: userList.filter(u => u.realNameVerified).length,
    banned: userList.filter(u => u.status === 'banned').length,
    pending: userList.filter(u => u.verificationStatus === 'pending').length,
  };

  res.json({ success: true, users: userList, stats });
});

// ─── 管理员：审核实名认证 ──────────────────────────────────
app.post('/api/admin/verify-user', adminAuth, (req, res) => {
  const { userId, action } = req.body;
  const user = users.get(userId);
  if (!user) return res.json({ success: false, error: '用户不存在' });

  if (action === 'approve') {
    user.realNameVerified = true;
    user.verificationStatus = 'approved';
    console.log(`[管理] 已通过 ${user.name}(${userId}) 的实名认证`);
  } else if (action === 'reject') {
    user.realNameVerified = false;
    user.verificationStatus = 'rejected';
    user.realName = '';
    user.idCard = '';
    console.log(`[管理] 已拒绝 ${user.name}(${userId}) 的实名认证`);
  }

  io.to(userId).emit('user-updated', sanitizeUser(user));
  res.json({ success: true, user: sanitizeUser(user) });
});

// ─── 管理员：封禁/解封用户 ──────────────────────────────────
app.post('/api/admin/toggle-status', adminAuth, (req, res) => {
  const { userId, action } = req.body;
  const user = users.get(userId);
  if (!user) return res.json({ success: false, error: '用户不存在' });

  if (action === 'ban') {
    user.status = 'banned';
    user.online = false;
    if (user.socketId) {
      const sock = io.sockets.sockets.get(user.socketId);
      if (sock) {
        sock.emit('force-logout', { reason: '账户已被管理员封禁' });
        sock.disconnect(true);
      }
    }
    console.log(`[管理] 已封禁 ${user.name}(${userId})`);
  } else if (action === 'unban') {
    user.status = 'active';
    console.log(`[管理] 已解封 ${user.name}(${userId})`);
  }

  res.json({ success: true, user: sanitizeUser(user) });
});

// ─── 管理员：导出用户数据 ──────────────────────────────────
app.get('/api/admin/export', adminAuth, (req, res) => {
  const format = req.query.format || 'json';
  const userList = [];
  for (const [, u] of users) {
    userList.push({
      手机号: u.phone, 昵称: u.name, 实名姓名: u.realName || '',
      身份证: u.idCard || '', 实名状态: u.realNameVerified ? '已认证' : (u.verificationStatus === 'pending' ? '审核中' : '未认证'),
      账户状态: u.status || 'active', 在线: u.online ? '是' : '否',
      红包余额: (u.balance || 0).toFixed(2), 注册时间: new Date(u.createdAt || 0).toLocaleString('zh-CN'),
    });
  }

  if (format === 'csv') {
    const headers = Object.keys(userList[0] || {});
    const csv = [headers.join(','),
      ...userList.map(u => headers.map(h => `"${(u[h]||'').replace(/"/g,'""')}"`).join(','))
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=wetalk_users_${Date.now()}.csv`);
    res.send('﻿' + csv);
  } else {
    res.json({ success: true, users: userList, total: userList.length });
  }
});

// ─── 管理员：敏感词管理 ──────────────────────────────────
app.get('/api/admin/sensitive-words', adminAuth, (req, res) => {
  res.json({ success: true, words: [...sensitiveWords] });
});
app.post('/api/admin/sensitive-words', adminAuth, (req, res) => {
  const { action, word } = req.body;
  if (action === 'add' && word) sensitiveWords.add(word);
  if (action === 'remove' && word) sensitiveWords.delete(word);
  res.json({ success: true, words: [...sensitiveWords] });
});

// ─── 管理员：设置账号类型 ──────────────────────────────────
app.post('/api/admin/set-account-type', adminAuth, (req, res) => {
  const { userId, accountType } = req.body;
  const user = users.get(userId);
  if (!user) return res.json({ success: false, error: '用户不存在' });
  if (!['internal', 'external'].includes(accountType)) return res.json({ success: false, error: '类型无效' });
  user.accountType = accountType;
  io.to(userId).emit('user-updated', sanitizeUser(user));
  res.json({ success: true, user: sanitizeUser(user) });
});

// ─── 网络状态接口 ──────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({
    server: 'WeTalk v2.0',
    uptime: process.uptime(),
    time: new Date().toISOString(),
    ips: getLocalIPs(),
    users: users.size,
    groups: groups.size,
  });
});

// ─── 数据存储 ──────────────────────────────────────────────
const verificationCodes = new Map();  // phone -> { code, expiresAt }
const users = new Map();              // userId -> userObject
const messages = new Map();           // chatId -> message[]
const redPackets = new Map();         // packetId -> { senderId, amount, opened, openedAt }
const groups = new Map();             // groupId -> GroupObject
const loginAttempts = new Map();      // phone -> { count, lockedUntil }
const ipRegistrations = new Map();    // ip -> { date, count }
const inviteCodes = new Set(['888888','666666','123456']);
const friendRequests = new Map();     // targetUserId -> [{ from, status, time, remark }]
const friends = new Map();            // userId -> Set<friendId>
const chatSettings = new Map();       // userId -> Map<chatId, { pinned, muted }>
const signIns = new Map();            // userId -> { lastDate, streak, total }
const sensitiveWords = new Set(['暴力','赌博','毒品','枪']);
const captchaStore = new Map();       // captchaId -> { code, expiresAt }
let captchaIdCounter = 0;

// GroupObject: { id, name, avatarColor, avatarChar, createdBy, createdAt, notice, members: [{userId, role, joinedAt}] }

// ─── 用户对象结构 ──────────────────────────────────────────
// {
//   id, name, phone, avatar (url or generated), avatarColor, avatarChar,
//   realName, idCard, realNameVerified: false,
//   online, socketId, balance: 0
// }

// ─── 颜色方案 ──────────────────────────────────────────────
const AVATAR_COLORS = [
  '#e74c3c','#e67e22','#f1c40f','#2ecc71',
  '#1abc9c','#3498db','#9b59b6','#34495e','#e84393','#00b894',
];

function getAvatarConfig(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return {
    char: name.charAt(0).toUpperCase(),
    color: AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length],
  };
}

// ─── 生成验证码 ────────────────────────────────────────────
app.post('/api/send-code', (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^1\d{10}$/.test(phone)) {
    return res.json({ success: false, error: '请输入有效手机号' });
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  verificationCodes.set(phone, { code, expiresAt: Date.now() + 300000 });
  // 模拟短信：服务器日志打印验证码
  console.log(`[验证码] ${phone} → ${code}`);
  // 返回验证码（demo 用，正式上线去掉）
  res.json({ success: true, code, message: '验证码已发送' });
});

// ─── 密码加密 ──────────────────────────────────────────────
function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd + 'wetalk_salt_2.0').digest('hex');
}

// ─── 生成图形验证码 ────────────────────────────────────────
app.post('/api/captcha', (req, res) => {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const id = `cap_${++captchaIdCounter}_${Date.now()}`;
  captchaStore.set(id, { code, expiresAt: Date.now() + 300000 });
  res.json({ success: true, captchaId: id, code }); // demo 返回code
});

// ─── 注册 ──────────────────────────────────────────────────
app.post('/api/register', (req, res) => {
  const { phone, password, captchaId, captcha, inviteCode } = req.body;

  // 校验手机号
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) return res.json({ success: false, error: '请输入有效手机号' });
  if (users.has(phone)) return res.json({ success: false, error: '该手机号已注册' });

  // 校验密码
  if (!password || password.length < 6 || password.length > 12) return res.json({ success: false, error: '密码需6-12位' });

  // 校验验证码
  const storedCap = captchaStore.get(captchaId);
  if (!storedCap || storedCap.code !== captcha || Date.now() > storedCap.expiresAt) {
    return res.json({ success: false, error: '验证码错误或已过期' });
  }
  captchaStore.delete(captchaId);

  // 校验邀请码
  if (!inviteCode || !inviteCodes.has(inviteCode)) return res.json({ success: false, error: '邀请码无效' });

  // IP注册限制
  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const today = new Date().toDateString();
  const ipReg = ipRegistrations.get(clientIp);
  if (ipReg && ipReg.date === today && ipReg.count >= 20) {
    return res.json({ success: false, error: '同一IP一天注册已达上限' });
  }

  // 创建用户
  const ac = getAvatarConfig(phone);
  const userId = phone;
  users.set(userId, {
    id: userId, name: `用户${phone.slice(-4)}`, phone,
    password: hashPassword(password),
    avatar: null, avatarColor: ac.color, avatarChar: ac.char,
    gender: '', realName: '', idCard: '', realNameVerified: false,
    verificationStatus: 'none',
    status: 'active', online: false, socketId: null,
    accountType: 'internal', // internal / external
    balance: 0, points: 0,
    inviteCode, inviter: null,
    createdAt: Date.now(),
  });

  // 更新IP注册计数
  if (ipReg && ipReg.date === today) ipReg.count++;
  else ipRegistrations.set(clientIp, { date: today, count: 1 });

  // 通知管理员有新用户
  console.log(`[注册] 新用户 ${phone} 使用邀请码 ${inviteCode}`);

  res.json({ success: true, message: '注册成功', needProfile: true, userId });
});

// ─── 密码登录 ──────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.json({ success: false, error: '请输入手机号和密码' });

  const user = users.get(phone);
  if (!user) return res.json({ success: false, error: '账号未注册' });

  // 检查封禁
  if (user.status === 'banned') return res.json({ success: false, error: '账号已被封禁' });

  // 检查登录锁定
  const attempt = loginAttempts.get(phone);
  if (attempt && attempt.lockedUntil > Date.now()) {
    const mins = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
    return res.json({ success: false, error: `密码错误次数过多，请${mins}分钟后再试` });
  }

  // 验证密码
  if (hashPassword(password) !== user.password) {
    const count = (attempt?.count || 0) + 1;
    const lockMins = Math.min(5 * Math.ceil(count / 5), 30);
    loginAttempts.set(phone, { count, lockedUntil: Date.now() + lockMins * 60000 });
    const remaining = 5 - (count % 5 || 5);
    if (remaining < 5) {
      return res.json({ success: false, error: `密码错误，还可尝试${remaining}次` });
    }
    return res.json({ success: false, error: '密码错误' });
  }

  // 登录成功，清除锁定记录
  loginAttempts.delete(phone);

  // 检查是否需要完善资料
  const needProfile = !user.name || user.name.startsWith('用户') || !user.gender;

  res.json({
    success: true,
    user: sanitizeUser(user),
    needProfile,
  });
});

// ─── 上传头像 ──────────────────────────────────────────────
app.post('/api/upload-avatar', upload.single('avatar'), (req, res) => {
  if (!req.file) return res.json({ success: false, error: '请选择图片' });
  const userId = req.body.userId;
  if (!userId || !users.has(userId)) {
    fs.unlinkSync(req.file.path);
    return res.json({ success: false, error: '用户不存在' });
  }

  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  const user = users.get(userId);
  // 删除旧头像文件（如果不是默认生成的）
  if (user.avatar && user.avatar.startsWith('/uploads/')) {
    const oldPath = path.join(__dirname, user.avatar);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  user.avatar = avatarUrl;
  res.json({ success: true, avatar: avatarUrl });
});

// ─── 工具函数 ──────────────────────────────────────────────
function sanitizeUser(u) {
  return {
    id: u.id, name: u.name, phone: u.phone,
    avatar: u.avatar, avatarColor: u.avatarColor, avatarChar: u.avatarChar,
    realName: u.realName, realNameVerified: u.realNameVerified,
    verificationStatus: u.verificationStatus || 'none',
    gender: u.gender || '',
    accountType: u.accountType || 'internal',
    status: u.status || 'active',
    online: u.online, balance: u.balance || 0,
    points: u.points || 0,
    createdAt: u.createdAt || 0,
  };
}

function sanitizeGroup(g, includeMembers) {
  const s = {
    id: g.id, name: g.name,
    avatarColor: g.avatarColor, avatarChar: g.avatarChar,
    createdBy: g.createdBy, createdAt: g.createdAt,
    notice: g.notice || '', memberCount: g.members.length,
  };
  if (includeMembers) s.members = g.members.map(m => ({ userId: m.userId, role: m.role }));
  return s;
}

function getChatId(a, b) { return [a, b].sort().join(':'); }

function genMsgId() { return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

// ─── Socket.io ─────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[连接] ${socket.id}`);

  // ─── 用户上线（socket 关联） ────────────────────────────
  socket.on('user-online', (userId, callback) => {
    const user = users.get(userId);
    if (!user) { callback?.({ success: false }); return; }

    // 检查是否被封禁
    if (user.status === 'banned') {
      callback?.({ success: false, error: '账户已被封禁，请联系管理员' });
      socket.emit('force-logout', { reason: '账户已被管理员封禁' });
      socket.disconnect(true);
      return;
    }

    user.online = true;
    user.socketId = socket.id;
    socket.userId = userId;
    socket.join(userId);

    // 加入所有群组 room
    for (const [, g] of groups) {
      if (g.members.some(m => m.userId === userId)) socket.join(g.id);
    }

    // 构建在线用户列表
    const onlineUsers = [];
    for (const [id, u] of users) {
      if (id !== userId && u.online) onlineUsers.push(sanitizeUser(u));
    }

    const chatList = getChatListForUser(userId);

    callback?.({
      success: true,
      user: sanitizeUser(user),
      users: onlineUsers,
      chats: chatList,
    });

    socket.broadcast.emit('user-online', sanitizeUser(user));
    console.log(`[上线] ${user.name} (${userId})`);
  });

  // ─── 获取用户资料 ──────────────────────────────────────
  socket.on('get-profile', (userId, callback) => {
    const u = users.get(userId);
    callback?.(u ? sanitizeUser(u) : null);
  });

  // ─── 更新昵称 ──────────────────────────────────────────
  socket.on('update-name', ({ userId, name }, callback) => {
    const user = users.get(userId);
    if (!user) { callback?.({ success: false, error: '用户不存在' }); return; }
    const trimmed = name.trim().slice(0, 16);
    if (!trimmed) { callback?.({ success: false, error: '昵称不能为空' }); return; }
    user.name = trimmed;
    const ac = getAvatarConfig(trimmed);
    // 如果没有自定义头像，更新默认头像颜色
    if (!user.avatar) {
      user.avatarColor = ac.color;
      user.avatarChar = ac.char;
    }
    callback?.({ success: true, user: sanitizeUser(user) });
    io.emit('user-updated', sanitizeUser(user));
  });

  // ─── 更新头像（base64） ─────────────────────────────────
  socket.on('update-avatar', ({ userId, dataUrl }, callback) => {
    const user = users.get(userId);
    if (!user) { callback?.({ success: false, error: '用户不存在' }); return; }
    if (!dataUrl || !dataUrl.startsWith('data:image/')) { callback?.({ success: false, error: '无效图片' }); return; }
    if (dataUrl.length > 2 * 1024 * 1024) { callback?.({ success: false, error: '图片过大' }); return; }
    user.avatar = dataUrl;
    callback?.({ success: true, avatar: dataUrl });
    io.emit('user-updated', sanitizeUser(user));
  });

  // ─── 更新性别 ──────────────────────────────────────────
  socket.on('update-gender', ({ userId, gender }, callback) => {
    const user = users.get(userId);
    if (!user || !['male','female'].includes(gender)) return callback?.({ success: false, error: '参数错误' });
    user.gender = gender;
    callback?.({ success: true, user: sanitizeUser(user) });
    io.emit('user-updated', sanitizeUser(user));
  });

  // ─── 完善资料（注册后） ──────────────────────────────
  socket.on('complete-profile', ({ userId, name, gender, avatar }, callback) => {
    const user = users.get(userId);
    if (!user) return callback?.({ success: false, error: '用户不存在' });
    if (name) { user.name = name.trim().slice(0, 12); const ac = getAvatarConfig(name); user.avatarColor = ac.color; user.avatarChar = ac.char; }
    if (gender) user.gender = gender;
    if (avatar && avatar.startsWith('data:image/')) user.avatar = avatar;
    callback?.({ success: true, user: sanitizeUser(user) });
    io.emit('user-updated', sanitizeUser(user));
  });

  // ─── 好友请求 ──────────────────────────────────────────
  socket.on('send-friend-request', ({ to, remark }, callback) => {
    const from = socket.userId;
    if (!from || !to || from === to) return callback?.({ success: false, error: '参数错误' });
    const targetUser = users.get(to);
    if (!targetUser) return callback?.({ success: false, error: '用户不存在' });
    const userFriends = friends.get(from);
    if (userFriends?.has(to)) return callback?.({ success: false, error: '已是好友' });
    const reqs = friendRequests.get(to) || [];
    if (reqs.some(r => r.from === from && r.status === 'pending')) return callback?.({ success: false, error: '已发送过请求' });
    if (!friendRequests.has(to)) friendRequests.set(to, []);
    friendRequests.get(to).push({ from, status: 'pending', time: Date.now(), remark: remark || '' });
    if (targetUser.online) io.to(to).emit('new-friend-request', { from: sanitizeUser(users.get(from)), remark: remark || '' });
    callback?.({ success: true });
  });

  socket.on('accept-friend-request', ({ from }, callback) => {
    const userId = socket.userId;
    const reqs = friendRequests.get(userId) || [];
    const req = reqs.find(r => r.from === from && r.status === 'pending');
    if (!req) return callback?.({ success: false, error: '请求不存在' });
    req.status = 'accepted';
    if (!friends.has(userId)) friends.set(userId, new Set());
    if (!friends.has(from)) friends.set(from, new Set());
    friends.get(userId).add(from);
    friends.get(from).add(userId);
    const me = users.get(userId);
    if (me?.online) io.to(from).emit('friend-added', { user: sanitizeUser(me) });
    callback?.({ success: true });
  });

  socket.on('reject-friend-request', ({ from }, callback) => {
    const userId = socket.userId;
    const reqs = friendRequests.get(userId) || [];
    const req = reqs.find(r => r.from === from && r.status === 'pending');
    if (!req) return callback?.({ success: false, error: '请求不存在' });
    req.status = 'rejected';
    callback?.({ success: true });
  });

  socket.on('get-friend-requests', (callback) => {
    const reqs = friendRequests.get(socket.userId) || [];
    callback(reqs.map(r => ({ ...r, fromUser: r.from ? sanitizeUser(users.get(r.from)) : null })));
  });

  socket.on('get-friends', (callback) => {
    const userFriends = friends.get(socket.userId);
    if (!userFriends) return callback([]);
    callback([...userFriends].map(id => users.get(id)).filter(Boolean).map(u => sanitizeUser(u)));
  });

  // ─── 聊天设置 ──────────────────────────────────────────
  function getChatSettings(userId) {
    if (!chatSettings.has(userId)) chatSettings.set(userId, new Map());
    return chatSettings.get(userId);
  }
  socket.on('toggle-chat-pin', ({ chatId }, callback) => {
    const s = getChatSettings(socket.userId); const cur = s.get(chatId) || {}; cur.pinned = !cur.pinned; s.set(chatId, cur);
    callback?.({ success: true, pinned: cur.pinned });
  });
  socket.on('toggle-chat-mute', ({ chatId }, callback) => {
    const s = getChatSettings(socket.userId); const cur = s.get(chatId) || {}; cur.muted = !cur.muted; s.set(chatId, cur);
    callback?.({ success: true, muted: cur.muted });
  });
  socket.on('delete-chat', ({ chatId }, callback) => {
    if (messages.has(chatId)) messages.delete(chatId);
    callback?.({ success: true });
  });

  // ─── 每日签到 ──────────────────────────────────────────
  socket.on('check-in', (callback) => {
    const userId = socket.userId;
    const user = users.get(userId);
    if (!user) return callback?.({ success: false, error: '未登录' });
    const today = new Date().toDateString();
    const record = signIns.get(userId);
    if (record && record.lastDate === today) return callback?.({ success: false, error: '今日已签到' });
    const streak = (record && record.lastDate === new Date(Date.now() - 86400000).toDateString()) ? (record.streak || 0) + 1 : 1;
    const pointsEarned = Math.min(10 + streak, 50);
    signIns.set(userId, { lastDate: today, streak, total: (record?.total || 0) + 1 });
    user.points = (user.points || 0) + pointsEarned;
    callback?.({ success: true, points: pointsEarned, total: user.points, streak });
    io.emit('user-updated', sanitizeUser(user));
  });

  // ─── 检测敏感词 ──────────────────────────────────────────
  socket.on('check-sensitive', ({ text }, callback) => {
    let hit = '';
    for (const w of sensitiveWords) { if (text.includes(w)) { hit = w; break; } }
    callback({ hasSensitive: !!hit, word: hit });
  });

  // ─── 实名认证 ──────────────────────────────────────────
  socket.on('verify-realname', ({ userId, realName, idCard }, callback) => {
    const user = users.get(userId);
    if (!user) { callback?.({ success: false, error: '用户不存在' }); return; }
    if (!realName || realName.length < 2) { callback?.({ success: false, error: '请输入真实姓名' }); return; }
    if (!/^\d{17}[\dXx]$/.test(idCard)) { callback?.({ success: false, error: '身份证号格式不正确' }); return; }

    user.realName = realName;
    user.idCard = idCard;
    user.realNameVerified = false;
    user.verificationStatus = 'pending';
    callback?.({ success: true, user: sanitizeUser(user) });
    io.emit('user-updated', sanitizeUser(user));
    console.log(`[实名] ${user.name} 提交认证申请，待审核`);
  });

  // ─── 搜索用户 ──────────────────────────────────────────
  socket.on('search-users', (query, callback) => {
    const results = [];
    const q = query.toLowerCase().trim();
    if (!q) { callback([]); return; }
    for (const [id, u] of users) {
      if ((u.name.toLowerCase().includes(q) || u.phone.includes(q)) && id !== socket.userId) {
        results.push(sanitizeUser(u));
      }
    }
    callback(results);
  });

  // ─── 创建群组 ──────────────────────────────────────────
  socket.on('create-group', ({ name, memberIds }, callback) => {
    const creatorId = socket.userId;
    if (!creatorId) return callback?.({ success: false, error: '未登录' });
    const trimmed = (name || '').trim().slice(0, 20);
    if (!trimmed) return callback?.({ success: false, error: '请输入群名称' });
    if (!memberIds || memberIds.length < 1) return callback?.({ success: false, error: '请选择至少一个群成员' });
    const allIds = [...new Set([creatorId, ...memberIds])];
    const ac = getAvatarConfig(trimmed);
    const groupId = `g_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const group = {
      id: groupId, name: trimmed, avatarColor: ac.color, avatarChar: ac.char,
      createdBy: creatorId, createdAt: Date.now(), notice: '',
      members: allIds.map((uid, i) => ({ userId: uid, role: uid === creatorId ? 'owner' : 'member', joinedAt: Date.now() })),
    };
    groups.set(groupId, group);
    allIds.forEach(uid => socket.join(groupId));
    callback?.({ success: true, group: sanitizeGroup(group) });
    console.log(`[群组] ${trimmed}(${groupId}) 由 ${creatorId} 创建`);
  });

  // ─── 获取用户的群组列表 ──────────────────────────────
  socket.on('get-my-groups', (callback) => {
    const userId = socket.userId;
    const result = [];
    for (const [, g] of groups) {
      if (g.members.some(m => m.userId === userId)) result.push(sanitizeGroup(g));
    }
    callback(result);
  });

  // ─── 获取群组详情 ──────────────────────────────────────
  socket.on('get-group-info', (groupId, callback) => {
    const g = groups.get(groupId);
    if (!g || !g.members.some(m => m.userId === socket.userId)) return callback?.({ success: false, error: '群组不存在' });
    const detailed = sanitizeGroup(g, true);
    detailed.memberDetails = g.members.map(m => ({
      userId: m.userId, role: m.role, joinedAt: m.joinedAt,
      user: sanitizeUser(users.get(m.userId)) || null,
    }));
    callback({ success: true, group: detailed });
  });

  // ─── 添加群成员 ──────────────────────────────────────
  socket.on('add-group-member', ({ groupId, userId: newUserId }, callback) => {
    const g = groups.get(groupId);
    if (!g) return callback?.({ success: false, error: '群组不存在' });
    const me = g.members.find(m => m.userId === socket.userId);
    if (!me || (me.role !== 'owner' && me.role !== 'admin')) return callback?.({ success: false, error: '无权限' });
    if (g.members.some(m => m.userId === newUserId)) return callback?.({ success: false, error: '已在群中' });
    g.members.push({ userId: newUserId, role: 'member', joinedAt: Date.now() });
    const sock = io.sockets.sockets.get(users.get(newUserId)?.socketId);
    if (sock) sock.join(groupId);
    io.to(groupId).emit('group-updated', sanitizeGroup(g));
    callback?.({ success: true, group: sanitizeGroup(g) });
  });

  // ─── 移除群成员 ──────────────────────────────────────
  socket.on('remove-group-member', ({ groupId, userId: targetId }, callback) => {
    const g = groups.get(groupId);
    if (!g) return callback?.({ success: false, error: '群组不存在' });
    const me = g.members.find(m => m.userId === socket.userId);
    if (!me || (me.role !== 'owner' && me.role !== 'admin')) return callback?.({ success: false, error: '无权限' });
    const target = g.members.find(m => m.userId === targetId);
    if (!target) return callback?.({ success: false, error: '用户不在群中' });
    if (target.role === 'owner') return callback?.({ success: false, error: '不能移除群主' });
    if (target.role === 'admin' && me.role !== 'owner') return callback?.({ success: false, error: '无权移除管理员' });
    g.members = g.members.filter(m => m.userId !== targetId);
    const sock = io.sockets.sockets.get(users.get(targetId)?.socketId);
    if (sock) sock.leave(groupId);
    io.to(groupId).emit('group-updated', sanitizeGroup(g));
    callback?.({ success: true, group: sanitizeGroup(g) });
  });

  // ─── 设置群角色（仅群主） ────────────────────────────
  socket.on('set-group-role', ({ groupId, userId: targetId, role }, callback) => {
    const g = groups.get(groupId);
    if (!g) return callback?.({ success: false, error: '群组不存在' });
    const me = g.members.find(m => m.userId === socket.userId);
    if (!me || me.role !== 'owner') return callback?.({ success: false, error: '仅群主可操作' });
    const target = g.members.find(m => m.userId === targetId);
    if (!target || target.role === 'owner') return callback?.({ success: false, error: '不能修改群主角色' });
    target.role = role;
    io.to(groupId).emit('group-updated', sanitizeGroup(g));
    callback?.({ success: true, group: sanitizeGroup(g) });
  });

  // ─── 发送文本消息 ──────────────────────────────────────
  socket.on('send-message', ({ to, text }, callback) => {
    const from = socket.userId;
    if (!from || !to || !text.trim()) return;

    const isGroup = to.startsWith('g_');
    const msg = {
      id: genMsgId(),
      from, to,
      type: 'text',
      text: text.trim(),
      time: Date.now(),
      status: 'sent',
      readAt: null,
    };

    if (isGroup) {
      // 群组消息
      const g = groups.get(to);
      if (!g || !g.members.some(m => m.userId === from)) return callback?.({ success: false, error: '群组不存在或已退出' });
      if (!messages.has(to)) messages.set(to, []);
      messages.get(to).push(msg);
      if (messages.get(to).length > 500) messages.set(to, messages.get(to).slice(-500));
      // 发给所有群成员（除自己）
      msg.status = 'delivered';
      socket.to(to).emit('new-message', msg);
      callback(msg);
      console.log(`[群消息] ${from} → ${to}: ${msg.text.slice(0, 30)}`);
      return;
    }

    // 单人消息
    const chatId = getChatId(from, to);
    if (!messages.has(chatId)) messages.set(chatId, []);
    messages.get(chatId).push(msg);
    if (messages.get(chatId).length > 500) {
      messages.set(chatId, messages.get(chatId).slice(-500));
    }

    const target = users.get(to);
    if (target?.online) {
      msg.status = 'delivered';
      io.to(to).emit('new-message', msg);
      io.to(from).emit('message-status', { messageId: msg.id, status: 'delivered', chatId });
    }

    callback(msg);
    console.log(`[消息] ${from} → ${to}: ${msg.text.slice(0, 30)}`);
  });

  // ─── 发送红包 ──────────────────────────────────────────
  socket.on('send-redpacket', ({ to, amount, blessing }, callback) => {
    const from = socket.userId;
    const sender = users.get(from);
    if (!from || !to || !sender) return;

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0 || amt > 200) {
      return callback?.({ success: false, error: '金额需在 0.01~200 元之间' });
    }

    const packetId = `rp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const msg = {
      id: genMsgId(),
      from, to,
      type: 'redpacket',
      text: blessing || '恭喜发财，大吉大利',
      time: Date.now(),
      status: 'sent',
      readAt: null,
      redpacket: {
        packetId,
        amount: Math.round(amt * 100) / 100,
        opened: false,
        openedAt: null,
      },
    };

    redPackets.set(packetId, {
      senderId: from,
      senderName: sender.name,
      amount: msg.redpacket.amount,
      opened: false,
      openedAt: null,
      openedBy: null,
    });

    const chatId = getChatId(from, to);
    if (!messages.has(chatId)) messages.set(chatId, []);
    messages.get(chatId).push(msg);
    if (messages.get(chatId).length > 500) {
      messages.set(chatId, messages.get(chatId).slice(-500));
    }

    const target = users.get(to);
    if (target?.online) {
      msg.status = 'delivered';
      io.to(to).emit('new-message', msg);
    }

    callback?.({ success: true, message: msg });
    console.log(`[红包] ${from} → ${to}: ¥${amt}`);
  });

  // ─── 打开红包 ──────────────────────────────────────────
  socket.on('open-redpacket', ({ messageId, packetId, chatPartnerId }, callback) => {
    const userId = socket.userId;
    const user = users.get(userId);
    const rp = redPackets.get(packetId);
    if (!rp) return callback?.({ success: false, error: '红包不存在或已过期' });
    if (rp.senderId === userId) return callback?.({ success: false, error: '不能抢自己的红包' });
    if (rp.opened) return callback?.({ success: false, error: '红包已被领取' });

    // 领取红包
    rp.opened = true;
    rp.openedAt = Date.now();
    rp.openedBy = userId;

    // 增加余额
    user.balance = (user.balance || 0) + rp.amount;

    // 更新消息中的红包状态
    const chatId = getChatId(rp.senderId, userId);
    const msgs = messages.get(chatId);
    if (msgs) {
      const msg = msgs.find(m => m.redpacket?.packetId === packetId);
      if (msg) {
        msg.redpacket.opened = true;
        msg.redpacket.openedAt = Date.now();
      }
    }

    callback?.({ success: true, amount: rp.amount, balance: user.balance, senderName: rp.senderName });

    // 通知发送者红包已被领取
    io.to(rp.senderId).emit('redpacket-opened', { packetId, openedBy: sanitizeUser(user), amount: rp.amount });

    console.log(`[红包] ${userId} 领取了 ${rp.senderId} 的红包 ¥${rp.amount}`);
  });

  // ─── 撤回消息（3 分钟内） ──────────────────────────────
  socket.on('recall-message', ({ messageId, to }, callback) => {
    const userId = socket.userId;
    const chatId = getChatId(userId, to);
    const msgs = messages.get(chatId);
    if (!msgs) return callback?.({ success: false, error: '消息不存在' });

    const msg = msgs.find(m => m.id === messageId);
    if (!msg) return callback?.({ success: false, error: '消息不存在' });
    if (msg.from !== userId) return callback?.({ success: false, error: '只能撤回自己的消息' });
    if (msg.type === 'recalled') return callback?.({ success: false, error: '消息已被撤回' });
    if (msg.type === 'redpacket') return callback?.({ success: false, error: '红包不能撤回' });

    const elapsed = Date.now() - msg.time;
    if (elapsed > 180000) return callback?.({ success: false, error: '已超过 3 分钟撤回时限' });

    const oldText = msg.text;
    msg.type = 'recalled';
    msg.text = '';
    msg.recalledAt = Date.now();

    callback?.({ success: true, messageId });

    // 通知对方
    const target = users.get(to);
    if (target?.online) {
      io.to(to).emit('message-recalled', { messageId, chatId, from: userId });
    }

    console.log(`[撤回] ${userId} 撤回了消息: ${oldText.slice(0, 20)}`);
  });

  // ─── 标记已读 ──────────────────────────────────────────
  socket.on('mark-read', ({ from }, callback) => {
    const userId = socket.userId;
    const chatId = getChatId(userId, from);
    const msgs = messages.get(chatId);
    if (!msgs) return;

    let count = 0;
    for (const m of msgs) {
      if (m.from === from && m.to === userId && m.status !== 'read') {
        m.status = 'read';
        m.readAt = Date.now();
        count++;
      }
    }

    // 通知对方消息已被读
    const reader = users.get(userId);
    if (count > 0) {
      io.to(from).emit('messages-read', { by: userId, chatId, count, readAt: Date.now() });
    }

    callback?.({ success: true, count });
  });

  // ─── 获取聊天记录 ──────────────────────────────────────
  socket.on('get-messages', ({ with: userId }, callback) => {
    const isGroup = userId.startsWith('g_');
    const chatId = isGroup ? userId : getChatId(socket.userId, userId);
    const msgs = messages.get(chatId) || [];
    callback(msgs);
  });

  // ─── 获取未读消息数 ────────────────────────────────────
  socket.on('get-unread', (callback) => {
    const userId = socket.userId;
    const result = {};
    for (const [chatId, msgs] of messages) {
      const parts = chatId.split(':');
      if (parts.includes(userId)) {
        const otherId = parts[0] === userId ? parts[1] : parts[0];
        const unread = msgs.filter(m => m.from === otherId && m.to === userId && m.status !== 'read').length;
        if (unread > 0) result[otherId] = unread;
      }
    }
    callback(result);
  });

  // ─── 输入状态 ──────────────────────────────────────────
  socket.on('typing', ({ to }) => {
    io.to(to).emit('user-typing', { from: socket.userId, name: users.get(socket.userId)?.name || '未知' });
  });

  socket.on('stop-typing', ({ to }) => {
    io.to(to).emit('user-stop-typing', { from: socket.userId });
  });

  // ─── 断线 ──────────────────────────────────────────────
  socket.on('disconnect', () => {
    if (socket.userId) {
      const user = users.get(socket.userId);
      if (user) {
        user.online = false;
        user.socketId = null;
      }
      socket.broadcast.emit('user-offline', { id: socket.userId });
      console.log(`[离线] ${socket.userId}`);
    }
  });
});

// ─── 获取聊天列表 ─────────────────────────────────────────
function getChatListForUser(userId) {
  const chatList = [];
  const seen = new Set();

  // 单人聊天
  for (const [chatId, msgs] of messages) {
    if (chatId.startsWith('g_')) continue;
    const parts = chatId.split(':');
    if (parts[0] === userId || parts[1] === userId) {
      const otherId = parts[0] === userId ? parts[1] : parts[0];
      if (seen.has(otherId)) continue;
      seen.add(otherId);

      const otherUser = users.get(otherId);
      if (!otherUser) continue;

      const lastMsg = msgs[msgs.length - 1];
      const unread = msgs.filter(m => m.from === otherId && m.to === userId && m.status !== 'read').length;

      chatList.push({
        id: otherId, type: 'user',
        with: sanitizeUser(otherUser),
        lastMessage: lastMsg ? { text: lastMsg.text, time: lastMsg.time, type: lastMsg.type } : null,
        unread,
      });
    }
  }

  // 群组聊天
  for (const [, g] of groups) {
    if (!g.members.some(m => m.userId === userId)) continue;
    const groupMsgs = messages.get(g.id) || [];
    const lastMsg = groupMsgs[groupMsgs.length - 1];
    chatList.push({
      id: g.id, type: 'group',
      with: { id: g.id, name: g.name, avatar: null, avatarColor: g.avatarColor, avatarChar: g.avatarChar, online: true },
      lastMessage: lastMsg ? { text: lastMsg.text, time: lastMsg.time, type: lastMsg.type } : null,
      unread: 0,
    });
  }

  chatList.sort((a, b) => {
    const ta = a.lastMessage?.time || 0;
    const tb = b.lastMessage?.time || 0;
    return tb - ta;
  });

  return chatList;
}

// ─── 启动服务器 ──────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  💬 Chat App v2.0 已启动`);
  console.log(`  📍 http://localhost:${PORT}`);
  console.log(`  🌐 局域网: http://${getLocalIP()}:${PORT}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
});

function getLocalIP() {
  const ips = getLocalIPs();
  return ips.find(ip => !ip.startsWith('127.')) || '127.0.0.1';
}

function getLocalIPs() {
  const result = [];
  const nets = require('os').networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) result.push(net.address);
    }
  }
  return result.length ? result : ['127.0.0.1'];
}
