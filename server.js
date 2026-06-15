const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const compression = require('compression');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || '*', methods: ['GET', 'POST'] },
  connectTimeout: 10000,
  pingTimeout: 5000,
  pingInterval: 10000,
});

const PORT = process.env.PORT || 3000;

// ─── Helmet 安全头 ─────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,  // Disabled to allow inline styles/scripts — enable with CSP policy in production
  crossOriginEmbedderPolicy: false,
}));
// Override CSP with a relaxed policy for the app's needs
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// ─── 环境检测：生产环境限制 CORS ────────────────────────────
if (process.env.NODE_ENV === 'production' && process.env.CORS_ORIGIN) {
  io.engine.opts.cors.origin = process.env.CORS_ORIGIN;
}

// ─── 速率限制 (内存版, 增强) ───────────────────────────────
class RateLimiter {
  constructor() {
    this.store = new Map();
    // Periodically clean stale entries (every 5 min)
    this.cleanupTimer = setInterval(() => this.cleanup(), 300000);
  }
  check(key, limit, windowMs) {
    const now = Date.now();
    if (!this.store.has(key)) this.store.set(key, []);
    const timestamps = this.store.get(key).filter(t => now - t < windowMs);
    timestamps.push(now);
    this.store.set(key, timestamps);
    return timestamps.length <= limit;
  }
  cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.store) {
      const fresh = timestamps.filter(t => now - t < 300000); // keep entries up to 5 min
      if (fresh.length === 0) this.store.delete(key);
      else this.store.set(key, fresh);
    }
  }
}

const rateLimiter = new RateLimiter();

// Per-endpoint rate limits
function loginRateLimit(req, res, next) {
  const key = 'login:' + (req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown');
  if (!rateLimiter.check(key, 10, 60000)) {
    return res.status(429).json({ success: false, error: '登录请求过于频繁，请稍后再试' });
  }
  next();
}

function registerRateLimit(req, res, next) {
  const key = 'register:' + (req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown');
  if (!rateLimiter.check(key, 5, 60000)) {
    return res.status(429).json({ success: false, error: '注册请求过于频繁，请稍后再试' });
  }
  next();
}

function smsRateLimit(req, res, next) {
  const key = 'sms:' + (req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown');
  if (!rateLimiter.check(key, 3, 60000)) {
    return res.status(429).json({ success: false, error: '验证码请求过于频繁，请稍后再试' });
  }
  next();
}

function apiRateLimit(req, res, next) {
  const key = 'api:' + (req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown');
  if (!rateLimiter.check(key, 120, 60000)) {
    return res.status(429).json({ success: false, error: '请求过于频繁' });
  }
  next();
}

// ─── 输入清理函数 ──────────────────────────────────────────
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>&"']/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
  })[c] || c);
}

// ─── 输入验证工具 ───────────────────────────────────────────
function isValidPhone(phone) {
  return typeof phone === 'string' && /^1[3-9]\d{9}$/.test(phone);
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 64;
}

function isValidName(name) {
  return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 32;
}

function stripNonText(s) {
  // Remove null bytes and other dangerous control characters
  if (typeof s !== 'string') return '';
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

// ─── HTTP 压缩 ────────────────────────────────────────────
app.use(compression({ level: 6, threshold: 512 }));

// ─── 请求日志 ──────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${res.statusCode} ${req.method} ${req.originalUrl} ${duration}ms`);
  });
  next();
});

// ─── 静态文件 ──────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  etag: true,
  lastModified: true,
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d',
  etag: true,
}));

// ─── 头像上传配置 ──────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads', 'avatars');
fs.mkdirSync(uploadsDir, { recursive: true });

// Allowed MIME types for uploads
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Only allow known extensions; fallback to .jpg if suspicious
    const safeExt = ALLOWED_EXTENSIONS.includes(ext) ? ext : '.jpg';
    cb(null, `avatar_${Date.now()}_${Math.random().toString(36).slice(2, 6)}${safeExt}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Validate MIME type and extension
    const mimeOk = ALLOWED_MIMES.includes(file.mimetype);
    const ext = path.extname(file.originalname).toLowerCase();
    const extOk = ALLOWED_EXTENSIONS.includes(ext);
    cb(null, mimeOk && extOk);
  },
});

// ─── 健康检查 ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    users: users.size,
    messages: messages.size,
    groups: groups.size,
    memory: process.memoryUsage().rss,
    node: process.version,
    platform: process.platform,
    timestamp: Date.now(),
  });
});

// ─── 管理员配置 ────────────────────────────────────────────
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin888';
// In production, require ADMIN_PASS to be set via environment variable
if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASS) {
  console.error('[安全] 生产环境必须设置 ADMIN_PASS 环境变量');
  process.exit(1);
}
const adminTokens = new Map(); // token -> { createdAt, expiresAt }

app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ─── 管理员鉴权中间件 ──────────────────────────────────────
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ success: false, error: '未授权，请重新登录' });
  }
  const session = adminTokens.get(token);
  if (Date.now() > session.expiresAt) {
    adminTokens.delete(token);
    return res.status(401).json({ success: false, error: '登录已过期，请重新登录' });
  }
  // Extend session on activity (sliding expiration, max 4h from last request)
  session.expiresAt = Math.min(session.expiresAt + 3600000, session.createdAt + 14400000);
  next();
}

// ─── 管理员登录 ────────────────────────────────────────────
app.post('/api/admin/login', apiRateLimit, (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ success: false, error: '参数无效' });
  }
  // Constant-time comparison to prevent timing attacks
  // Note: crypto.timingSafeEqual requires buffers of equal length
  if (Buffer.byteLength(username) !== Buffer.byteLength(ADMIN_USER) ||
      Buffer.byteLength(password) !== Buffer.byteLength(ADMIN_PASS)) {
    return res.status(401).json({ success: false, error: '账号或密码错误' });
  }
  const userOk = crypto.timingSafeEqual(Buffer.from(username), Buffer.from(ADMIN_USER));
  const passOk = crypto.timingSafeEqual(Buffer.from(password), Buffer.from(ADMIN_PASS));
  if (userOk && passOk) {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    adminTokens.set(token, { createdAt: now, expiresAt: now + 3600000 }); // 1 hour expiry
    // Limit sessions to 5 per admin
    if (adminTokens.size > 5) {
      const oldest = [...adminTokens.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
      if (oldest) adminTokens.delete(oldest[0]);
    }
    return res.json({ success: true, token, admin: { username: ADMIN_USER } });
  }
  res.json({ success: false, error: '管理员账号或密码错误' });
});

// ─── 密码策略 ──────────────────────────────────────────────
// Minimum requirements: 8+ chars, at least one letter and one digit or special char
function validatePasswordStrength(password) {
  if (!password || password.length < 8 || password.length > 64) {
    return { valid: false, error: '密码长度需 8-64 位' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: '密码需包含至少一个字母' };
  }
  if (!/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: '密码需包含至少一个数字或特殊字符' };
  }
  return { valid: true };
}

// ─── 密码加密 (bcrypt) ────────────────────────────────────
const BCRYPT_ROUNDS = 10;

async function hashPassword(pwd) {
  return bcrypt.hash(pwd, BCRYPT_ROUNDS);
}

async function comparePassword(pwd, hash) {
  return bcrypt.compare(pwd, hash);
}

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

// ─── 生成验证码 (带速率限制) ──────────────────────────────
app.post('/api/send-code', smsRateLimit, (req, res) => {
  const { phone } = req.body || {};
  if (!phone || !/^1\d{10}$/.test(phone)) {
    return res.json({ success: false, error: '请输入有效手机号' });
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  verificationCodes.set(phone, { code, expiresAt: Date.now() + 300000 });
  console.log(`[验证码] ${phone} → ${code}`);
  res.json({ success: true, code, message: '验证码已发送' });
});

// ─── 生成图形验证码 ────────────────────────────────────────
app.post('/api/captcha', apiRateLimit, (req, res) => {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const id = `cap_${++captchaIdCounter}_${Date.now()}`;
  captchaStore.set(id, { code, expiresAt: Date.now() + 300000 });
  res.json({ success: true, captchaId: id, code }); // demo returns code
});

// ─── 注册 ──────────────────────────────────────────────────
app.post('/api/register', registerRateLimit, async (req, res) => {
  const { phone, password, captchaId, captcha, inviteCode } = req.body || {};

  // Validate types and presence
  if (!phone || typeof phone !== 'string') return res.json({ success: false, error: '请输入有效手机号' });
  if (!password || typeof password !== 'string') return res.json({ success: false, error: '请输入密码' });

  // Input validation
  if (!isValidPhone(phone)) return res.json({ success: false, error: '请输入有效手机号' });
  if (users.has(phone)) return res.json({ success: false, error: '该手机号已注册' });

  // Password strength validation
  const pwCheck = validatePasswordStrength(password);
  if (!pwCheck.valid) return res.json({ success: false, error: pwCheck.error });

  // Validate captcha
  if (!captchaId || typeof captchaId !== 'string' || !captcha || typeof captcha !== 'string') {
    return res.json({ success: false, error: '验证码参数无效' });
  }
  const storedCap = captchaStore.get(captchaId);
  if (!storedCap || storedCap.code !== captcha || Date.now() > storedCap.expiresAt) {
    return res.json({ success: false, error: '验证码错误或已过期' });
  }
  captchaStore.delete(captchaId);

  // Validate invite code
  if (!inviteCode || typeof inviteCode !== 'string' || !inviteCodes.has(inviteCode)) {
    return res.json({ success: false, error: '邀请码无效' });
  }

  // IP registration limit
  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  const today = new Date().toDateString();
  const ipReg = ipRegistrations.get(clientIp);
  if (ipReg && ipReg.date === today && ipReg.count >= 20) {
    return res.json({ success: false, error: '同一IP一天注册已达上限' });
  }

  // Hash password with bcrypt (async)
  let hashedPwd;
  try {
    hashedPwd = await hashPassword(password);
  } catch (e) {
    console.error('[注册] 密码加密失败:', e.message);
    return res.json({ success: false, error: '注册失败，请重试' });
  }

  // Create user
  const ac = getAvatarConfig(phone);
  const userId = phone;
  users.set(userId, {
    id: userId, name: `用户${phone.slice(-4)}`, phone,
    password: hashedPwd,
    avatar: null, avatarColor: ac.color, avatarChar: ac.char,
    gender: '', realName: '', idCard: '', realNameVerified: false,
    verificationStatus: 'none',
    status: 'active', online: false, socketId: null,
    accountType: 'internal',
    balance: 0, points: 0,
    inviteCode, inviter: null,
    createdAt: Date.now(),
  });

  // Update IP registration count
  if (ipReg && ipReg.date === today) ipReg.count++;
  else ipRegistrations.set(clientIp, { date: today, count: 1 });

  console.log(`[注册] 新用户 ${phone} 使用邀请码 ${inviteCode}`);

  res.json({ success: true, message: '注册成功', needProfile: true, userId });
});

// ─── 密码登录 ──────────────────────────────────────────────
app.post('/api/login', loginRateLimit, async (req, res) => {
  const { phone, password } = req.body || {};
  if (!phone || typeof phone !== 'string' || !password || typeof password !== 'string') {
    return res.json({ success: false, error: '请输入手机号和密码' });
  }

  const user = users.get(phone);
  if (!user) return res.json({ success: false, error: '账号未注册' });

  // Check ban
  if (user.status === 'banned') return res.json({ success: false, error: '账号已被封禁' });

  // Check login lockout
  const attempt = loginAttempts.get(phone);
  if (attempt && attempt.lockedUntil > Date.now()) {
    const mins = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
    return res.json({ success: false, error: `密码错误次数过多，请${mins}分钟后再试` });
  }

  // Verify password with bcrypt (async)
  let passwordMatch;
  try {
    passwordMatch = (user.password.startsWith('$2b$') || user.password.startsWith('$2a$'))
      ? await comparePassword(password, user.password)
      // Legacy SHA256 hash support for loaded data
      : (crypto.createHash('sha256').update(password + 'wetalk_salt_2.0').digest('hex') === user.password);
  } catch (e) {
    passwordMatch = false;
  }

  if (!passwordMatch) {
    const count = (attempt?.count || 0) + 1;
    const lockMins = Math.min(5 * Math.ceil(count / 5), 30);
    loginAttempts.set(phone, { count, lockedUntil: Date.now() + lockMins * 60000 });
    const remaining = 5 - (count % 5 || 5);
    if (remaining < 5) {
      return res.json({ success: false, error: `密码错误，还可尝试${remaining}次` });
    }
    return res.json({ success: false, error: '密码错误' });
  }

  // Successful login — clear attempts
  loginAttempts.delete(phone);

  // Upgrade legacy password to bcrypt on successful login
  if (!user.password.startsWith('$2b$') && !user.password.startsWith('$2a$')) {
    try {
      user.password = await hashPassword(password);
    } catch (e) {
      console.error('[登录] 密码升级失败:', e.message);
    }
  }

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
    try { fs.unlinkSync(req.file.path); } catch(e) { /* ignore */ }
    return res.json({ success: false, error: '用户不存在' });
  }

  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  const user = users.get(userId);
  if (user.avatar && user.avatar.startsWith('/uploads/')) {
    const oldPath = path.join(__dirname, user.avatar);
    try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); } catch(e) { /* ignore */ }
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

// ─── Login notification helper ─────────────────────────────
function notifyLogin(user) {
  // Simple logging — in production would send push notification or email
  console.log(`[登录通知] 用户 ${user.name}(${user.phone}) 于 ${new Date().toLocaleString('zh-CN')} 登录`);
}

// ─── Socket.io ─────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[连接] ${socket.id}`);

  // ─── User online (socket association) ────────────────────
  socket.on('user-online', (userId, callback) => {
    if (typeof userId !== 'string' || !userId) {
      callback?.({ success: false });
      return;
    }
    const user = users.get(userId);
    if (!user) { callback?.({ success: false }); return; }

    if (user.status === 'banned') {
      callback?.({ success: false, error: '账户已被封禁，请联系管理员' });
      socket.emit('force-logout', { reason: '账户已被管理员封禁' });
      socket.disconnect(true);
      return;
    }

    // If user already has an active socket, disconnect the old one
    if (user.socketId && user.socketId !== socket.id) {
      const oldSocket = io.sockets.sockets.get(user.socketId);
      if (oldSocket) {
        oldSocket.emit('force-logout', { reason: '您的账户已在其他设备登录' });
        oldSocket.disconnect(true);
      }
    }

    user.online = true;
    user.socketId = socket.id;
    socket.userId = userId;
    socket.join(userId);

    for (const [, g] of groups) {
      if (g.members.some(m => m.userId === userId)) socket.join(g.id);
    }

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
    notifyLogin(user);
  });

  // ─── Get profile ─────────────────────────────────────────
  socket.on('get-profile', (userId, callback) => {
    if (typeof userId !== 'string') { callback?.(null); return; }
    const u = users.get(userId);
    callback?.(u ? sanitizeUser(u) : null);
  });

  // ─── Update name ─────────────────────────────────────────
  socket.on('update-name', ({ userId, name }, callback) => {
    if (typeof userId !== 'string' || typeof name !== 'string') {
      callback?.({ success: false, error: '参数无效' }); return;
    }
    const user = users.get(userId);
    if (!user) { callback?.({ success: false, error: '用户不存在' }); return; }
    const trimmed = name.trim().replace(/[\x00-\x1F\x7F<>]/g, '').slice(0, 16);
    if (!trimmed) { callback?.({ success: false, error: '昵称不能为空或包含非法字符' }); return; }
    user.name = trimmed;
    const ac = getAvatarConfig(trimmed);
    if (!user.avatar) {
      user.avatarColor = ac.color;
      user.avatarChar = ac.char;
    }
    callback?.({ success: true, user: sanitizeUser(user) });
    io.emit('user-updated', sanitizeUser(user));
  });

  // ─── Update avatar (base64) ──────────────────────────────
  socket.on('update-avatar', ({ userId, dataUrl }, callback) => {
    if (typeof userId !== 'string' || typeof dataUrl !== 'string') {
      callback?.({ success: false, error: '参数无效' }); return;
    }
    const user = users.get(userId);
    if (!user) { callback?.({ success: false, error: '用户不存在' }); return; }
    if (!dataUrl.startsWith('data:image/')) { callback?.({ success: false, error: '无效图片' }); return; }
    if (dataUrl.length > 2 * 1024 * 1024) { callback?.({ success: false, error: '图片过大' }); return; }
    user.avatar = dataUrl;
    callback?.({ success: true, avatar: dataUrl });
    io.emit('user-updated', sanitizeUser(user));
  });

  // ─── Update gender ───────────────────────────────────────
  socket.on('update-gender', ({ userId, gender }, callback) => {
    if (typeof userId !== 'string' || typeof gender !== 'string') {
      return callback?.({ success: false, error: '参数无效' });
    }
    const user = users.get(userId);
    if (!user || !['male','female'].includes(gender)) return callback?.({ success: false, error: '参数错误' });
    user.gender = gender;
    callback?.({ success: true, user: sanitizeUser(user) });
    io.emit('user-updated', sanitizeUser(user));
  });

  // ─── Complete profile ────────────────────────────────────
  socket.on('complete-profile', ({ userId, name, gender, avatar }, callback) => {
    if (typeof userId !== 'string') return callback?.({ success: false, error: '参数无效' });
    const user = users.get(userId);
    if (!user) return callback?.({ success: false, error: '用户不存在' });
    if (name && typeof name === 'string') {
      const cleanName = name.trim().replace(/[\x00-\x1F\x7F<>]/g, '').slice(0, 12);
      if (cleanName) {
        user.name = cleanName;
        const ac = getAvatarConfig(cleanName);
        user.avatarColor = ac.color;
        user.avatarChar = ac.char;
      }
    }
    if (gender && typeof gender === 'string' && ['male','female'].includes(gender)) user.gender = gender;
    if (avatar && typeof avatar === 'string' && avatar.startsWith('data:image/')) user.avatar = avatar;
    callback?.({ success: true, user: sanitizeUser(user) });
    io.emit('user-updated', sanitizeUser(user));
  });

  // ─── Friend request ─────────────────────────────────────
  socket.on('send-friend-request', ({ to, remark }, callback) => {
    const from = socket.userId;
    if (!from || typeof to !== 'string' || from === to) return callback?.({ success: false, error: '参数错误' });
    if (from === to) return callback?.({ success: false, error: '不能添加自己为好友' });
    const targetUser = users.get(to);
    if (!targetUser) return callback?.({ success: false, error: '用户不存在' });
    const userFriends = friends.get(from);
    if (userFriends?.has(to)) return callback?.({ success: false, error: '已是好友' });
    const reqs = friendRequests.get(to) || [];
    if (reqs.some(r => r.from === from && r.status === 'pending')) return callback?.({ success: false, error: '已发送过请求' });
    if (!friendRequests.has(to)) friendRequests.set(to, []);
    friendRequests.get(to).push({ from, status: 'pending', time: Date.now(), remark: typeof remark === 'string' ? sanitize(remark).slice(0, 100) : '' });
    if (targetUser.online) io.to(to).emit('new-friend-request', { from: sanitizeUser(users.get(from)), remark: remark || '' });
    callback?.({ success: true });
  });

  socket.on('accept-friend-request', ({ from }, callback) => {
    if (typeof from !== 'string') return callback?.({ success: false, error: '参数无效' });
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
    if (typeof from !== 'string') return callback?.({ success: false, error: '参数无效' });
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

  // ─── Chat settings ───────────────────────────────────────
  function getChatSettings(userId) {
    if (!chatSettings.has(userId)) chatSettings.set(userId, new Map());
    return chatSettings.get(userId);
  }
  socket.on('toggle-chat-pin', ({ chatId }, callback) => {
    if (typeof chatId !== 'string') return;
    const s = getChatSettings(socket.userId); const cur = s.get(chatId) || {}; cur.pinned = !cur.pinned; s.set(chatId, cur);
    callback?.({ success: true, pinned: cur.pinned });
  });
  socket.on('toggle-chat-mute', ({ chatId }, callback) => {
    if (typeof chatId !== 'string') return;
    const s = getChatSettings(socket.userId); const cur = s.get(chatId) || {}; cur.muted = !cur.muted; s.set(chatId, cur);
    callback?.({ success: true, muted: cur.muted });
  });
  socket.on('delete-chat', ({ chatId }, callback) => {
    if (typeof chatId !== 'string') return;
    if (messages.has(chatId)) messages.delete(chatId);
    callback?.({ success: true });
  });

  // ─── Daily check-in ──────────────────────────────────────
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

  // ─── Group management ────────────────────────────────────
  socket.on('set-group-notice', ({ groupId, notice }, callback) => {
    if (typeof groupId !== 'string') return callback?.({ success: false });
    const g = groups.get(groupId); if (!g) return callback?.({ success: false });
    const me = g.members.find(m => m.userId === socket.userId);
    if (!me || (me.role !== 'owner' && me.role !== 'admin')) return callback?.({ success: false, error: '无权限' });
    g.notice = stripNonText((notice || '')).slice(0, 200);
    const s = sanitizeGroup(g); io.to(groupId).emit('group-updated', s);
    callback?.({ success: true, group: s });
  });
  socket.on('group-mute-all', ({ groupId, muted }, callback) => {
    if (typeof groupId !== 'string') return callback?.({ success: false });
    const g = groups.get(groupId); if (!g) return callback?.({ success: false });
    if (g.members.find(m=>m.userId===socket.userId)?.role!=='owner') return callback?.({ success: false, error: '仅群主可操作' });
    g.muted = !!muted; const s = sanitizeGroup(g); io.to(groupId).emit('group-updated', s);
    callback?.({ success: true, muted: g.muted });
  });
  socket.on('transfer-group', ({ groupId, toUserId }, callback) => {
    if (typeof groupId !== 'string' || typeof toUserId !== 'string') return callback?.({ success: false, error: '参数无效' });
    const g = groups.get(groupId); if (!g) return callback?.({ success: false, error: '群组不存在' });
    if (g.members.find(m=>m.userId===socket.userId)?.role!=='owner') return callback?.({ success: false, error: '仅群主可操作' });
    const t = g.members.find(m=>m.userId===toUserId); if(!t) return callback?.({ success: false, error: '用户不在群中' });
    const o = g.members.find(m=>m.role==='owner'); if(o) o.role='member'; t.role='owner';
    const s = sanitizeGroup(g); io.to(groupId).emit('group-updated', s);
    callback?.({ success: true, group: s });
  });
  socket.on('disband-group', ({ groupId }, callback) => {
    if (typeof groupId !== 'string') return callback?.({ success: false, error: '参数无效' });
    const g = groups.get(groupId); if (!g) return callback?.({ success: false, error: '群组不存在' });
    if (g.members.find(m=>m.userId===socket.userId)?.role!=='owner') return callback?.({ success: false, error: '仅群主可操作' });
    io.to(groupId).emit('group-disbanded', { groupId });
    groups.delete(groupId); callback?.({ success: true });
  });

  // ─── Sensitive word check ────────────────────────────────
  socket.on('check-sensitive', ({ text }, callback) => {
    if (typeof text !== 'string') { callback({ hasSensitive: false, word: '' }); return; }
    let hit = '';
    for (const w of sensitiveWords) { if (text.includes(w)) { hit = w; break; } }
    callback({ hasSensitive: !!hit, word: hit });
  });

  // ─── Favorites ───────────────────────────────────────────
  const favorites = new Map();
  socket.on('favorite-message', ({ messageId, chatId }, callback) => {
    if (typeof messageId !== 'string' || typeof chatId !== 'string') return;
    const uid = socket.userId; const msgs = messages.get(chatId); const msg = msgs?.find(m => m.id === messageId);
    if (!msg) return callback?.({ success: false, error: '消息不存在' });
    if (!favorites.has(uid)) favorites.set(uid, []);
    if (favorites.get(uid).some(f => f.messageId === messageId)) return callback?.({ success: false, error: '已收藏' });
    favorites.get(uid).unshift({ id: `fav_${Date.now()}`, messageId, chatId, text: msg.text || '[消息]', from: msg.from, time: Date.now(), type: msg.type });
    callback?.({ success: true });
  });
  socket.on('get-favorites', (callback) => { callback(favorites.get(socket.userId) || []); });
  socket.on('delete-favorite', ({ id }, callback) => {
    if (typeof id !== 'string') return;
    const favs = favorites.get(socket.userId); if (!favs) return;
    const idx = favs.findIndex(f => f.id === id); if (idx > -1) favs.splice(idx, 1);
    callback?.({ success: true });
  });

  // ─── Forward message ─────────────────────────────────────
  socket.on('forward-message', ({ messageId, toUserId }, callback) => {
    if (typeof messageId !== 'string' || typeof toUserId !== 'string') return;
    const from = socket.userId; let originalMsg = null;
    for (const [, msgs] of messages) { const m = msgs.find(m => m.id === messageId); if (m) { originalMsg = m; break; } }
    if (!originalMsg) return callback?.({ success: false, error: '消息不存在' });
    const targetChat = getChatId(from, toUserId);
    const newMsg = { id: genMsgId(), from, to: targetChat, type: 'text', text: originalMsg.text, time: Date.now(), status: 'sent', readAt: null };
    if (!messages.has(targetChat)) messages.set(targetChat, []);
    messages.get(targetChat).push(newMsg);
    const target = users.get(toUserId);
    if (target?.online) { newMsg.status = 'delivered'; io.to(toUserId).emit('new-message', newMsg); }
    callback?.({ success: true });
  });

  // ─── Change password ─────────────────────────────────────
  socket.on('change-password', async ({ oldPassword, newPassword }, callback) => {
    if (typeof oldPassword !== 'string' || typeof newPassword !== 'string') {
      return callback?.({ success: false, error: '参数无效' });
    }
    const user = users.get(socket.userId);
    if (!user) return callback?.({ success: false, error: '未登录' });

    // Verify old password with bcrypt
    let oldMatch;
    try {
      oldMatch = (user.password.startsWith('$2b$') || user.password.startsWith('$2a$'))
        ? await comparePassword(oldPassword, user.password)
        : (crypto.createHash('sha256').update(oldPassword + 'wetalk_salt_2.0').digest('hex') === user.password);
    } catch(e) { oldMatch = false; }
    if (!oldMatch) return callback?.({ success: false, error: '原密码错误' });

    // Validate new password strength
    const pwCheck = validatePasswordStrength(newPassword);
    if (!pwCheck.valid) return callback?.({ success: false, error: pwCheck.error });
    if (oldPassword === newPassword) return callback?.({ success: false, error: '新密码不能与原密码相同' });

    try {
      user.password = await hashPassword(newPassword);
    } catch (e) {
      return callback?.({ success: false, error: '密码修改失败，请重试' });
    }
    callback?.({ success: true });
  });

  // ─── Search messages ─────────────────────────────────────
  socket.on('search-messages', ({ keyword, chatId }, callback) => {
    if (typeof keyword !== 'string') keyword = '';
    const uid = socket.userId; const results = [];
    const chats = chatId ? [chatId] : [...messages.keys()].filter(k => k.includes(uid) || k.startsWith('g_'));
    const kw = keyword.toLowerCase();
    for (const cid of chats) {
      for (const m of (messages.get(cid) || [])) {
        if (m.text && m.text.toLowerCase().includes(kw) && (m.from === uid || m.to === uid || cid.startsWith('g_')))
          results.push({ ...m, chatId: cid });
      }
    }
    callback(results.slice(-30));
  });

  // ─── Real-name verification ──────────────────────────────
  socket.on('verify-realname', ({ userId, realName, idCard }, callback) => {
    if (typeof userId !== 'string' || typeof realName !== 'string' || typeof idCard !== 'string') {
      callback?.({ success: false, error: '参数无效' }); return;
    }
    const user = users.get(userId);
    if (!user) { callback?.({ success: false, error: '用户不存在' }); return; }
    const cleanName = realName.trim().replace(/[\x00-\x1F\x7F<>]/g, '');
    if (cleanName.length < 2) { callback?.({ success: false, error: '请输入真实姓名' }); return; }
    if (!/^\d{17}[\dXx]$/.test(idCard)) { callback?.({ success: false, error: '身份证号格式不正确' }); return; }

    user.realName = cleanName;
    user.idCard = idCard;
    user.realNameVerified = false;
    user.verificationStatus = 'pending';
    callback?.({ success: true, user: sanitizeUser(user) });
    io.emit('user-updated', sanitizeUser(user));
    console.log(`[实名] ${user.name} 提交认证申请，待审核`);
  });

  // ─── Search users ────────────────────────────────────────
  socket.on('search-users', (query, callback) => {
    if (typeof query !== 'string') { callback([]); return; }
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

  // ─── Create group ────────────────────────────────────────
  socket.on('create-group', ({ name, memberIds }, callback) => {
    const creatorId = socket.userId;
    if (!creatorId) return callback?.({ success: false, error: '未登录' });
    if (typeof name !== 'string') return callback?.({ success: false, error: '请输入群名称' });
    const trimmed = name.trim().replace(/[\x00-\x1F\x7F<>]/g, '').slice(0, 20);
    if (!trimmed) return callback?.({ success: false, error: '请输入群名称' });
    if (!Array.isArray(memberIds) || memberIds.length < 1) return callback?.({ success: false, error: '请选择至少一个群成员' });
    // Validate all memberIds are strings
    for (const mid of memberIds) {
      if (typeof mid !== 'string') return callback?.({ success: false, error: '参数无效' });
    }
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

  // ─── Get user's group list ───────────────────────────────
  socket.on('get-my-groups', (callback) => {
    const userId = socket.userId;
    const result = [];
    for (const [, g] of groups) {
      if (g.members.some(m => m.userId === userId)) result.push(sanitizeGroup(g));
    }
    callback(result);
  });

  // ─── Get group info ──────────────────────────────────────
  socket.on('get-group-info', (groupId, callback) => {
    if (typeof groupId !== 'string') return callback?.({ success: false, error: '参数无效' });
    const g = groups.get(groupId);
    if (!g || !g.members.some(m => m.userId === socket.userId)) return callback?.({ success: false, error: '群组不存在' });
    const detailed = sanitizeGroup(g, true);
    detailed.memberDetails = g.members.map(m => ({
      userId: m.userId, role: m.role, joinedAt: m.joinedAt,
      user: sanitizeUser(users.get(m.userId)) || null,
    }));
    callback({ success: true, group: detailed });
  });

  // ─── Add group member ────────────────────────────────────
  socket.on('add-group-member', ({ groupId, userId: newUserId }, callback) => {
    if (typeof groupId !== 'string' || typeof newUserId !== 'string') return;
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

  // ─── Remove group member ─────────────────────────────────
  socket.on('remove-group-member', ({ groupId, userId: targetId }, callback) => {
    if (typeof groupId !== 'string' || typeof targetId !== 'string') return;
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

  // ─── Set group role ──────────────────────────────────────
  socket.on('set-group-role', ({ groupId, userId: targetId, role }, callback) => {
    if (typeof groupId !== 'string' || typeof targetId !== 'string' || typeof role !== 'string') return;
    const g = groups.get(groupId);
    if (!g) return callback?.({ success: false, error: '群组不存在' });
    const me = g.members.find(m => m.userId === socket.userId);
    if (!me || me.role !== 'owner') return callback?.({ success: false, error: '仅群主可操作' });
    const target = g.members.find(m => m.userId === targetId);
    if (!target || target.role === 'owner') return callback?.({ success: false, error: '不能修改群主角色' });
    if (!['admin', 'member'].includes(role)) return callback?.({ success: false, error: '无效角色' });
    target.role = role;
    io.to(groupId).emit('group-updated', sanitizeGroup(g));
    callback?.({ success: true, group: sanitizeGroup(g) });
  });

  // ─── Send text message ───────────────────────────────────
  socket.on('send-message', ({ to, text }, callback) => {
    const from = socket.userId;
    if (!from || typeof to !== 'string' || typeof text !== 'string' || !text.trim()) return;

    const isGroup = to.startsWith('g_');
    const msg = {
      id: genMsgId(),
      from, to,
      type: 'text',
      text: stripNonText(text.trim()),
      time: Date.now(),
      status: 'sent',
      readAt: null,
    };

    if (isGroup) {
      const g = groups.get(to);
      if (!g || !g.members.some(m => m.userId === from)) return callback?.({ success: false, error: '群组不存在或已退出' });
      if (!messages.has(to)) messages.set(to, []);
      messages.get(to).push(msg);
      if (messages.get(to).length > 500) messages.set(to, messages.get(to).slice(-500));
      msg.status = 'delivered';
      socket.to(to).emit('new-message', msg);
      callback(msg);
      console.log(`[群消息] ${from} → ${to}: ${msg.text.slice(0, 30)}`);
      return;
    }

    // Single chat
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

  // ─── Send image message ─────────────────────────────────
  // Ensure uploads/images directory exists
  const imagesDir = path.join(__dirname, 'uploads', 'images');
  try { fs.mkdirSync(imagesDir, { recursive: true }); } catch (e) { /* ignore */ }

  socket.on('send-image', ({ to, dataUrl, fileName }, callback) => {
    const from = socket.userId;
    if (!from || typeof to !== 'string' || typeof dataUrl !== 'string') {
      return callback?.({ error: '参数不完整' });
    }

    // Validate and decode base64 data URL
    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/);
    if (!match) return callback?.({ error: '无效的图片格式' });

    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');

    // Size check (5MB base64 → ~3.7MB raw — OK)
    if (buffer.length > 5 * 1024 * 1024) {
      return callback?.({ error: '图片不能超过 5MB' });
    }

    const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filepath = path.join(imagesDir, filename);
    try { fs.writeFileSync(filepath, buffer); } catch (e) {
      return callback?.({ error: '图片保存失败' });
    }

    const imageUrl = `/uploads/images/${filename}`;
    const isGroup = to.startsWith('g_');
    const msg = {
      id: genMsgId(),
      from, to,
      type: 'image',
      text: imageUrl,
      imageUrl,
      time: Date.now(),
      status: 'sent',
      readAt: null,
    };

    if (isGroup) {
      const g = groups.get(to);
      if (!g || !g.members.some(m => m.userId === from)) {
        try { fs.unlinkSync(filepath); } catch (e) { /* ignore */ }
        return callback?.({ error: '群组不存在或已退出' });
      }
      if (!messages.has(to)) messages.set(to, []);
      messages.get(to).push(msg);
      if (messages.get(to).length > 500) messages.set(to, messages.get(to).slice(-500));
      msg.status = 'delivered';
      socket.to(to).emit('new-message', msg);
      callback(msg);
      console.log(`[图片消息] ${from} → 群 ${to}: ${filename}`);
      return;
    }

    // Single chat
    const chatId = getChatId(from, to);
    if (!messages.has(chatId)) messages.set(chatId, []);
    messages.get(chatId).push(msg);
    if (messages.get(chatId).length > 500) messages.set(chatId, messages.get(chatId).slice(-500));

    const target = users.get(to);
    if (target?.online) {
      msg.status = 'delivered';
      io.to(to).emit('new-message', msg);
      io.to(from).emit('message-status', { messageId: msg.id, status: 'delivered', chatId });
    }

    callback(msg);
    console.log(`[图片消息] ${from} → ${to}: ${filename}`);
  });

  // ─── Send red packet ────────────────────────────────────
  socket.on('send-redpacket', ({ to, amount, blessing }, callback) => {
    if (typeof to !== 'string') return;
    const from = socket.userId;
    const sender = users.get(from);
    if (!from || !to || !sender) return;

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0 || amt > 200) {
      return callback?.({ success: false, error: '金额需在 0.01~200 元之间' });
    }

    // Round to 2 decimal places
    const roundedAmt = Math.round(amt * 100) / 100;

    const packetId = `rp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const msg = {
      id: genMsgId(),
      from, to,
      type: 'redpacket',
      text: (blessing && typeof blessing === 'string' ? stripNonText(blessing).slice(0, 50) : '恭喜发财，大吉大利'),
      time: Date.now(),
      status: 'sent',
      readAt: null,
      redpacket: {
        packetId,
        amount: roundedAmt,
        opened: false,
        openedAt: null,
      },
    };

    redPackets.set(packetId, {
      senderId: from,
      senderName: sender.name,
      amount: roundedAmt,
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
    console.log(`[红包] ${from} → ${to}: ¥${roundedAmt}`);
  });

  // ─── Open red packet ────────────────────────────────────
  socket.on('open-redpacket', ({ messageId, packetId, chatPartnerId }, callback) => {
    if (typeof packetId !== 'string') return;
    const userId = socket.userId;
    const user = users.get(userId);
    const rp = redPackets.get(packetId);
    if (!rp) return callback?.({ success: false, error: '红包不存在或已过期' });
    if (rp.senderId === userId) return callback?.({ success: false, error: '不能抢自己的红包' });
    if (rp.opened) return callback?.({ success: false, error: '红包已被领取' });

    rp.opened = true;
    rp.openedAt = Date.now();
    rp.openedBy = userId;
    user.balance = (user.balance || 0) + rp.amount;

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
    io.to(rp.senderId).emit('redpacket-opened', { packetId, openedBy: sanitizeUser(user), amount: rp.amount });
    console.log(`[红包] ${userId} 领取了 ${rp.senderId} 的红包 ¥${rp.amount}`);
  });

  // ─── Recall message ────────────────────────────────────
  socket.on('recall-message', ({ messageId, to }, callback) => {
    if (typeof messageId !== 'string' || typeof to !== 'string') return;
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

    msg.type = 'recalled';
    msg.text = '';
    msg.recalledAt = Date.now();

    callback?.({ success: true, messageId });

    const target = users.get(to);
    if (target?.online) {
      io.to(to).emit('message-recalled', { messageId, chatId, from: userId });
    }

    console.log(`[撤回] ${userId} 撤回了消息`);
  });

  // ─── Mark as read ──────────────────────────────────────
  socket.on('mark-read', ({ from }, callback) => {
    if (typeof from !== 'string') return;
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

    const reader = users.get(userId);
    if (count > 0) {
      io.to(from).emit('messages-read', { by: userId, chatId, count, readAt: Date.now() });
    }

    callback?.({ success: true, count });
  });

  // ─── Get messages ──────────────────────────────────────
  socket.on('get-messages', ({ with: userId }, callback) => {
    if (typeof userId !== 'string') { callback([]); return; }
    const isGroup = userId.startsWith('g_');
    const chatId = isGroup ? userId : getChatId(socket.userId, userId);
    const msgs = messages.get(chatId) || [];
    callback(msgs);
  });

  // ─── Get unread counts ─────────────────────────────────
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

  // ─── Typing indicator ──────────────────────────────────
  socket.on('typing', ({ to }) => {
    if (typeof to !== 'string') return;
    io.to(to).emit('user-typing', { from: socket.userId, name: users.get(socket.userId)?.name || '未知' });
  });

  socket.on('stop-typing', ({ to }) => {
    if (typeof to !== 'string') return;
    io.to(to).emit('user-stop-typing', { from: socket.userId });
  });

  // ─── WebRTC signaling ─────────────────────────────────
  socket.on('call-user', (data, callback) => {
    if (!data || typeof data.to !== 'string') return;
    const from = socket.userId;
    const to = data.to;
    if (!from || !to) return;
    const caller = users.get(from);
    if (!caller) return;
    const target = users.get(to);
    if (!target?.online) {
      callback?.({ success: false, error: '对方不在线' });
      return;
    }
    io.to(to).emit('call-incoming', {
      from,
      fromName: data.fromName || caller.name,
      signal: data.signal || data.signalData,
      video: data.video || false,
      avatar: data.avatar || caller.avatar || null,
      avatarColor: data.avatarColor || caller.avatarColor || '#1aad19',
      avatarChar: data.avatarChar || caller.avatarChar || '?',
    });
    callback?.({ success: true });
    console.log(`[通话] ${caller.name} 呼叫 ${target.name}`);
  });

  socket.on('accept-call', (data, callback) => {
    if (!data || typeof data.to !== 'string') return;
    const from = socket.userId;
    if (!from || !data.to) return;
    io.to(data.to).emit('call-accepted', {
      from,
      signal: data.signal || data.signalData,
    });
    callback?.({ success: true });
  });

  socket.on('call-signal', (data) => {
    if (!data || typeof data.to !== 'string') return;
    const from = socket.userId;
    if (!from || !data.to) return;
    io.to(data.to).emit('call-signal', {
      from,
      signal: data.signal || data.signalData,
    });
  });

  socket.on('end-call', ({ to }) => {
    if (typeof to !== 'string') return;
    const from = socket.userId;
    if (!from || !to) return;
    io.to(to).emit('call-ended', { from });
  });

  // ─── Disconnect ──────────────────────────────────────
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

// ─── Admin endpoints ───────────────────────────────────────

// ─── Admin: Get all users ──────────────────────────────────
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

// ─── Admin: Verify user ────────────────────────────────────
app.post('/api/admin/verify-user', adminAuth, (req, res) => {
  const { userId, action } = req.body || {};
  if (typeof userId !== 'string') return res.json({ success: false, error: '参数无效' });
  if (typeof action !== 'string' || !['approve', 'reject'].includes(action)) return res.json({ success: false, error: '参数无效' });
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

// ─── Admin: Toggle user status ─────────────────────────────
app.post('/api/admin/toggle-status', adminAuth, (req, res) => {
  const { userId, action } = req.body || {};
  if (typeof userId !== 'string' || typeof action !== 'string') return res.json({ success: false, error: '参数无效' });
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
  } else {
    return res.json({ success: false, error: '无效操作' });
  }

  res.json({ success: true, user: sanitizeUser(user) });
});

// ─── Admin: Export user data ───────────────────────────────
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

// ─── Admin: Sensitive words management ────────────────────
app.get('/api/admin/sensitive-words', adminAuth, (req, res) => {
  res.json({ success: true, words: [...sensitiveWords] });
});
app.post('/api/admin/sensitive-words', adminAuth, (req, res) => {
  const { action, word } = req.body || {};
  if (typeof action !== 'string' || typeof word !== 'string' || !word.trim()) {
    return res.json({ success: false, error: '参数无效' });
  }
  const cleanWord = word.trim().slice(0, 20);
  if (action === 'add') sensitiveWords.add(cleanWord);
  if (action === 'remove') sensitiveWords.delete(cleanWord);
  res.json({ success: true, words: [...sensitiveWords] });
});

// ─── Admin: Set account type ───────────────────────────────
app.post('/api/admin/set-account-type', adminAuth, (req, res) => {
  const { userId, accountType } = req.body || {};
  if (typeof userId !== 'string' || typeof accountType !== 'string') return res.json({ success: false, error: '参数无效' });
  const user = users.get(userId);
  if (!user) return res.json({ success: false, error: '用户不存在' });
  if (!['internal', 'external'].includes(accountType)) return res.json({ success: false, error: '类型无效' });
  user.accountType = accountType;
  io.to(userId).emit('user-updated', sanitizeUser(user));
  res.json({ success: true, user: sanitizeUser(user) });
});

// ─── Admin: Generate invite code ──────────────────────────
app.post('/api/admin/generate-invite', adminAuth, (req, res) => {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  inviteCodes.add(code);
  res.json({ success: true, code, allCodes: [...inviteCodes] });
});

app.get('/api/admin/invite-codes', adminAuth, (req, res) => {
  res.json({ success: true, codes: [...inviteCodes] });
});

// ─── Operation logs ─────────────────────────────────────
const operationLogs = [];
function addLog(admin, action, detail) {
  operationLogs.unshift({ admin, action, detail, time: Date.now() });
  if (operationLogs.length > 500) operationLogs.length = 500;
}

// ─── Admin: Get groups ──────────────────────────────────
app.get('/api/admin/groups', adminAuth, (req, res) => {
  const groupList = [];
  for (const [, g] of groups) {
    groupList.push({
      id: g.id, name: g.name,
      createdBy: g.createdBy,
      createdAt: g.createdAt,
      memberCount: g.members.length,
      notice: g.notice || '',
      onlineCount: g.members.filter(m => users.get(m.userId)?.online).length,
    });
  }
  groupList.sort((a, b) => b.memberCount - a.memberCount);
  res.json({ success: true, groups: groupList, total: groupList.length });
});

// ─── Admin: Disband group ──────────────────────────────
app.post('/api/admin/disband-group', adminAuth, (req, res) => {
  const { groupId } = req.body || {};
  if (typeof groupId !== 'string') return res.json({ success: false, error: '参数无效' });
  const g = groups.get(groupId);
  if (!g) return res.json({ success: false, error: '群组不存在' });
  io.to(groupId).emit('group-disbanded', { groupId });
  groups.delete(groupId);
  addLog('admin', '解散群组', `解散群 ${g.name}(${groupId})`);
  res.json({ success: true });
});

// ─── Admin: Get messages ──────────────────────────────
app.get('/api/admin/messages', adminAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const allMsgs = [];
  for (const [chatId, msgs] of messages) {
    for (const m of msgs.slice(-50)) {
      const fromUser = users.get(m.from);
      allMsgs.push({
        id: m.id, chatId,
        from: m.from, fromName: fromUser?.name || '未知',
        type: m.type || 'text',
        text: (m.text || '').slice(0, 100),
        time: m.time,
        status: m.status,
      });
    }
  }
  allMsgs.sort((a, b) => b.time - a.time);
  res.json({ success: true, messages: allMsgs.slice(0, limit), total: allMsgs.length });
});

// ─── Admin: Get red packets ──────────────────────────
app.get('/api/admin/redpackets', adminAuth, (req, res) => {
  const packets = [];
  for (const [id, rp] of redPackets) {
    packets.push({
      packetId: id, senderId: rp.senderId, senderName: rp.senderName,
      amount: rp.amount, opened: rp.opened,
      openedAt: rp.openedAt, openedBy: rp.openedBy,
    });
  }
  packets.sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0));
  res.json({ success: true, packets, total: packets.length, totalAmount: packets.reduce((s, p) => s + p.amount, 0).toFixed(2) });
});

// ─── Admin: Get stats ────────────────────────────
app.get('/api/admin/stats', adminAuth, (req, res) => {
  const online = [...users.values()].filter(u => u.online).length;
  const verified = [...users.values()].filter(u => u.realNameVerified).length;
  const banned = [...users.values()].filter(u => u.status === 'banned').length;
  const pending = [...users.values()].filter(u => u.verificationStatus === 'pending').length;

  let totalMessages = 0;
  for (const [, msgs] of messages) totalMessages += msgs.length;

  const today = new Date().toDateString();
  let todaySignIns = 0;
  for (const [, rec] of signIns) {
    if (rec.lastDate === today) todaySignIns++;
  }

  const totalRedPackets = redPackets.size;
  const openedPackets = [...redPackets.values()].filter(r => r.opened).length;

  res.json({
    success: true,
    stats: {
      users: { total: users.size, online, verified, banned, pending },
      messages: { total: totalMessages },
      groups: { total: groups.size },
      signIns: { today: todaySignIns },
      redPackets: { total: totalRedPackets, opened: openedPackets },
      server: { uptime: process.uptime(), version: '2.0' },
    },
  });
});

// ─── Admin: Settings ───────────────────────────
const systemSettings = {
  allowRegister: true,
  maintenanceMode: false,
  maxMessageLength: 1000,
};
app.get('/api/admin/settings', adminAuth, (req, res) => {
  res.json({ success: true, settings: systemSettings });
});
app.post('/api/admin/settings', adminAuth, (req, res) => {
  const { key, value } = req.body || {};
  if (typeof key !== 'string') return res.json({ success: false, error: '参数无效' });
  if (key in systemSettings) {
    systemSettings[key] = value;
    addLog('admin', '修改设置', `${key} = ${JSON.stringify(value)}`);
    res.json({ success: true, settings: systemSettings });
  } else {
    res.json({ success: false, error: '无效设置项' });
  }
});

// ─── Admin: Logs ───────────────────────────
app.get('/api/admin/logs', adminAuth, (req, res) => {
  res.json({ success: true, logs: operationLogs.slice(0, 200) });
});

// ─── Admin: Search messages ───────────────────────────
app.get('/api/admin/search-messages', adminAuth, (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q) return res.json({ success: true, messages: [] });
  const results = [];
  for (const [chatId, msgs] of messages) {
    for (const m of msgs) {
      if (m.text && m.text.toLowerCase().includes(q)) {
        const fromUser = users.get(m.from);
        results.push({
          id: m.id, chatId, from: m.from, fromName: fromUser?.name || '未知',
          text: m.text.slice(0, 150), time: m.time, type: m.type,
        });
      }
    }
  }
  results.sort((a, b) => b.time - a.time);
  res.json({ success: true, messages: results.slice(0, 100) });
});

// ─── Status endpoint ───────────────────────────
app.get('/api/status', (req, res) => {
  res.json({
    server: 'WeTalk v2.0',
    uptime: process.uptime(),
    time: new Date().toISOString(),
    ips: getLocalIPs(),
    users: users.size,
    groups: groups.size,
    messages: [...messages.values()].reduce((s, m) => s + m.length, 0),
    settings: systemSettings,
  });
});

// ─── Get chat list ───────────────────────────
function getChatListForUser(userId) {
  const chatList = [];
  const seen = new Set();

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

// ─── Data persistence ──────────────────────────
const DATA_FILE = path.join(__dirname, 'data', 'backup.json');
let savePending = false;

function saveData() {
  if (savePending) return; // debounce
  savePending = true;
  setImmediate(() => {
    savePending = false;
    try {
      const dataDir = path.join(__dirname, 'data');
      fs.mkdirSync(dataDir, { recursive: true });
      const backup = {
        time: Date.now(),
        users: [...users].map(([k, v]) => {
          const { password, ...rest } = v;
          return [k, rest];
        }),
        messages: [...messages].map(([k, v]) => [k, v.slice(-200)]),
        groups: [...groups],
        redPackets: [...redPackets],
        inviteCodes: [...inviteCodes],
        friendRequests: [...friendRequests],
        friends: [...friends].map(([k, v]) => [k, [...v]]),
        signIns: [...signIns],
        chatSettings: [...chatSettings].map(([k, v]) => [k, [...v]]),
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(backup, null, 2), 'utf-8');
      console.log(`[备份] 已保存 ${users.size} 用户, ${messages.size} 聊天`);
    } catch (e) {
      console.error('[备份] 保存失败:', e.message);
    }
  });
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!data.users) return;

    data.users.forEach(([k, v]) => users.set(k, {
      ...v,
      password: v.password || '', // Keep bcrypt hash if saved; empty string if old data
    }));
    data.messages.forEach(([k, v]) => messages.set(k, v));
    data.groups.forEach(([k, v]) => groups.set(k, v));
    data.redPackets.forEach(([k, v]) => redPackets.set(k, v));
    data.inviteCodes.forEach(c => inviteCodes.add(c));
    data.friendRequests.forEach(([k, v]) => friendRequests.set(k, v));
    data.friends.forEach(([k, v]) => friends.set(k, new Set(v)));
    data.signIns.forEach(([k, v]) => signIns.set(k, v));
    data.chatSettings.forEach(([k, v]) => chatSettings.set(k, new Map(v)));
    console.log(`[恢复] 已加载 ${users.size} 用户, ${messages.size} 聊天, ${groups.size} 群组`);
  } catch (e) {
    console.error('[恢复] 加载失败:', e.message);
  }
}

// ─── Push notification endpoints ───────────────────
const PUSH_SUBSCRIPTIONS = new Map();

app.post('/api/push/subscribe', (req, res) => {
  const { userId, subscription } = req.body || {};
  if (!userId || typeof userId !== 'string' || !subscription || !subscription.endpoint) {
    return res.status(400).json({ success: false, error: '参数不完整' });
  }
  PUSH_SUBSCRIPTIONS.set(userId, subscription);
  console.log(`[Push] 用户 ${userId} 已订阅推送`);
  res.json({ success: true });
});

app.post('/api/push/unsubscribe', (req, res) => {
  const { userId } = req.body || {};
  if (userId && typeof userId === 'string') PUSH_SUBSCRIPTIONS.delete(userId);
  res.json({ success: true });
});

app.post('/api/push/send', (req, res) => {
  const { targetUserId, title, body, url, tag } = req.body || {};
  if (typeof targetUserId !== 'string') return res.status(400).json({ success: false, error: '参数无效' });
  const subscription = PUSH_SUBSCRIPTIONS.get(targetUserId);
  if (!subscription) {
    return res.status(404).json({ success: false, error: '用户未订阅推送' });
  }

  const payload = JSON.stringify({
    title: title || 'WeTalk',
    body: body || '',
    url: url || '/',
    tag: tag || 'chat-message',
    messageId: null,
    chatId: null,
    senderId: null,
    actions: [
      { action: 'open', title: '打开聊天' },
    ],
  });

  try {
    const webpush = require('web-push');
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@wetalk.app',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
      webpush.sendNotification(subscription, payload).then(() => {
        res.json({ success: true });
      }).catch((err) => {
        console.error(`[Push] 发送失败:`, err.message);
        if (err.statusCode === 410 || err.statusCode === 404) {
          PUSH_SUBSCRIPTIONS.delete(targetUserId);
        }
        res.status(500).json({ success: false, error: '发送失败' });
      });
    } else {
      res.status(503).json({ success: false, error: 'VAPID 密钥未配置' });
    }
  } catch (e) {
    res.status(503).json({ success: false, error: 'web-push 依赖未安装' });
  }
});

app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({
    publicKey: process.env.VAPID_PUBLIC_KEY || null,
    configured: !!process.env.VAPID_PUBLIC_KEY,
  });
});

app.get('/api/notifications/check', (req, res) => {
  const userId = req.query.userId;
  if (!userId || typeof userId !== 'string') return res.json({ hasNew: false, count: 0 });
  res.json({ hasNew: false, count: 0 });
});

// ─── Graceful shutdown ──────────────────────────
function shutdown(signal) {
  console.log(`\n[退出] 收到 ${signal}，正在保存数据...`);
  clearInterval(saveTimer);
  saveData();
  setTimeout(() => {
    console.log('[退出] 关闭服务器...');
    server.close(() => {
      console.log('[退出] 服务器已关闭，再见！');
      process.exit(0);
    });
  }, 2000);
  // Force exit after 10s regardless
  setTimeout(() => {
    console.error('[退出] 强制退出');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Periodic save every 60 seconds
let saveTimer = setInterval(saveData, 60000);

// ─── Load on startup ──────────────────────────
loadData();

// ─── Start server ──────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const memMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  💬 WeTalk v2.0 已启动`);
  console.log(`  📍 http://localhost:${PORT}`);
  console.log(`  🌐 局域网: http://${getLocalIP()}:${PORT}`);
  console.log(`  🖥️  Node ${process.version} | ${os.platform()} | RSS ${memMB}MB`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
});

function getLocalIP() {
  const ips = getLocalIPs();
  return ips.find(ip => !ip.startsWith('127.')) || '127.0.0.1';
}

function getLocalIPs() {
  const result = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) result.push(net.address);
    }
  }
  return result.length ? result : ['127.0.0.1'];
}
