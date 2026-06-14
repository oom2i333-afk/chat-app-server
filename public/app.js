// ═══════════════════════════════════════════════════════════════
// WeTalk - 客户端逻辑 v2.0
// 手机验证 · 红包 · 已读 · 撤回 · 个人资料
// ═══════════════════════════════════════════════════════════════

const socket = io();

// ─── 强制下线（管理员封禁） ──────────────────────────────
socket.on('force-logout', ({ reason }) => {
  alert(reason || '账户已被管理员封禁');
  socket.disconnect();
  location.reload();
});

// ─── 状态 ──────────────────────────────────────────────────
let currentUser = null;           // 当前登录用户完整信息
let contacts = new Map();         // id -> user object
let activeChat = null;            // 当前聊天对象 id
let messageCache = new Map();     // chatId -> messages[]
let typingTimeout = null;
let codeTimer = null;
let codeCountdown = 0;
let currentRpMessage = null;      // 当前打开的红包消息
let myGroups = [];                 // 群组列表

// ─── DOM ────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// 登录页
const loginPage = $('loginPage');
const mainPage = $('mainPage');
const phoneInput = $('phoneInput');
const codeInput = $('codeInput');
const sendCodeBtn = $('sendCodeBtn');
const loginBtn = $('loginBtn');

// 侧栏
const sidebarProfile = $('sidebarProfile');
const profileAvatar = $('profileAvatar');
const profileAvatarChar = $('profileAvatarChar');
const profileName = $('profileName');
const chatList = $('chatList');
const contactList = $('contactList');
const searchChat = $('searchChat');
const tabs = document.querySelectorAll('.tab');
const addContactBtn2 = $('addContactBtn2');
const logoutBtn = $('logoutBtn');

// 聊天区
const emptyState = $('emptyState');
const chatWindow = $('chatWindow');
const messagesContainer = $('messagesContainer');
const messageInput = $('messageInput');
const sendBtn = $('sendBtn');
const chatName = $('chatName');
const chatStatus = $('chatStatus');
const chatAvatar = $('chatAvatar');
const typingIndicator = $('typingIndicator');
const emojiBtn = $('emojiBtn');
const emojiPanel = $('emojiPanel');
const emojiGrid = $('emojiGrid');
const mobileBack = $('mobileBack');
const redpacketBtn = $('redpacketBtn');

// 弹窗
const addContactModal = $('addContactModal');
const modalOverlay = $('modalOverlay');
const modalClose = $('modalClose');
const searchUserInput = $('searchUserInput');
const searchResults = $('searchResults');

// 个人资料
const profilePanel = $('profilePanel');
const ppAvatar = $('ppAvatar');
const ppAvatarChar = $('ppAvatarChar');
const ppChangeAvatar = $('ppChangeAvatar');
const avatarInput = $('avatarInput');
const ppName = $('ppName');
const ppEditName = $('ppEditName');
const ppPhone = $('ppPhone');
const ppRealNameStatus = $('ppRealNameStatus');
const ppRealNameRow = $('ppRealNameRow');
const ppBalance = $('ppBalance');
const ppLogout = $('ppLogout');

// 编辑昵称
const nameEditModal = $('nameEditModal');
const nameModalOverlay = $('nameModalOverlay');
const nameModalClose = $('nameModalClose');
const nameEditInput = $('nameEditInput');
const nameSaveBtn = $('nameSaveBtn');

// 实名认证
const realnameModal = $('realnameModal');
const realnameOverlay = $('realnameOverlay');
const realnameClose = $('realnameClose');
const realnameInput = $('realnameInput');
const idcardInput = $('idcardInput');
const realnameSubmitBtn = $('realnameSubmitBtn');

// 红包
const redpacketModal = $('redpacketModal');
const rpModalOverlay = $('rpModalOverlay');
const rpClose = $('rpClose');
const rpTo = $('rpTo');
const rpAmount = $('rpAmount');
const rpBlessing = $('rpBlessing');
const rpSendBtn = $('rpSendBtn');
const rpFastBtns = document.querySelectorAll('.rp-fast');
const openRpOverlay = $('openRpOverlay');
const rpOpenUnopened = $('rpOpenUnopened');
const rpOpenResult = $('rpOpenResult');
const rpOpenSender = $('rpOpenSender');
const rpOpenBlessing = $('rpOpenBlessing');
const rpOpenBtn = $('rpOpenBtn');
const rpResultAmount = $('rpResultAmount');
const rpResultFrom = $('rpResultFrom');
const rpResultClose = $('rpResultClose');
const rpOpenClose = $('rpOpenClose');

// 群组
const createGroupBtn = $('createGroupBtn');
const createGroupModal = $('createGroupModal');
const cgModalOverlay = $('cgModalOverlay');
const cgModalClose = $('cgModalClose');
const cgNameInput = $('cgNameInput');
const cgSearchInput = $('cgSearchInput');
const cgContactList = $('cgContactList');
const cgCreateBtn = $('cgCreateBtn');
const groupInfoModal = $('groupInfoModal');
const giModalOverlay = $('giModalOverlay');
const giModalClose = $('giModalClose');
const giAvatar = $('giAvatar');
const giName = $('giName');
const giCount = $('giCount');
const giActions = $('giActions');
const giMembers = $('giMembers');

// Toast
const toastContainer = $('toastContainer');

// ═══════════════════════════════════════════════════════════════
// Emoji
// ═══════════════════════════════════════════════════════════════
const EMOJI_MAP = {
  all: ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','😘','🥰','😗','😙','😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲','☺️','😖','😞','😟','😤','😢','😭','😦','😧','😨','😩','🤯','😬','😰','😱','🥵','🥶','😳','🤪','😵','😡','😠','🤬','👍','👎','👊','✊','🤛','🤜','👏','🙌','🤲','🤝','✌️','🤟','🤞','❤️','🧡','💛','💚','💙','💜','🖤','💔','💕','💞','💗','💖','🔥','⭐','✨','💪','🦊','🐶','🐱','🐼','🐸','🐤','🦄','🌸','🎉','🎊','💰','🧧','🎁','🎈'],
  faces: ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','😘','🥰','😗','😙','😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲','☺️','😖','😞','😟','😤','😢','😭','😦','😧','😨','😩','🤯','😬','😰','😱','🥵','🥶','😳','🤪','😵','😡','😠','🤬'],
  hearts: ['❤️','🧡','💛','💚','💙','💜','🖤','💔','💕','💞','💗','💖','❣️','💝'],
  hands: ['👍','👎','👊','✊','🤛','🤜','👏','🙌','🤲','🤝','✌️','🤟','🤞','👋','🤚','🖐️'],
  animals: ['🦊','🐶','🐱','🐼','🐸','🐤','🦄','🌸','🐰','🦁','🐯','🐮','🐷','🐵','🐔','🐧','🐦','🐤','🐣','🐺','🦋','🐛','🐝','🐞'],
};

function renderEmojis(cat = 'all') {
  const list = EMOJI_MAP[cat] || EMOJI_MAP.all;
  emojiGrid.innerHTML = list.map(e => `<span>${e}</span>`).join('');
  emojiGrid.querySelectorAll('span').forEach(el => {
    el.onclick = () => {
      messageInput.value += el.textContent;
      messageInput.focus();
      emojiPanel.style.display = 'none';
    };
  });
}
renderEmojis();

document.querySelectorAll('.emoji-cat').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.emoji-cat').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderEmojis(btn.dataset.cat);
  });
});

emojiBtn.onclick = (e) => {
  e.stopPropagation();
  emojiPanel.style.display = emojiPanel.style.display === 'none' ? 'block' : 'none';
};
document.addEventListener('click', (e) => {
  if (!emojiPanel.contains(e.target) && e.target !== emojiBtn) {
    emojiPanel.style.display = 'none';
  }
});

// ═══════════════════════════════════════════════════════════════
// Toast
// ═══════════════════════════════════════════════════════════════
function showToast(msg, duration = 2000) {
  const el = document.createElement('div');
  el.className = 'wt-toast';
  el.textContent = msg;
  toastContainer.appendChild(el);
  setTimeout(() => { el.remove(); }, duration);
}

// ═══════════════════════════════════════════════════════════════
// 登录 / 注册
// ═══════════════════════════════════════════════════════════════
let selectedGender = '';
let setupAvatarDataUrl = '';

// ─── Login/Register Tab ──────────────────────────────────
document.querySelectorAll('.login-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.login-form').forEach(f => f.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab === 'login' ? 'loginForm' : 'registerForm').classList.add('active');
    document.getElementById('loginError').textContent = '';
    document.getElementById('regError').textContent = '';
  });
});

// ─── 密码可见切换 ────────────────────────────────────────
document.querySelectorAll('.pw-toggle').forEach(el => {
  el.addEventListener('click', () => {
    const input = el.parentElement.querySelector('input');
    input.type = input.type === 'password' ? 'text' : 'password';
    el.textContent = input.type === 'password' ? '👁' : '👁‍🗨';
  });
});

// ─── Captcha 刷新 ────────────────────────────────────────
let currentCaptchaId = '';
let currentRegCaptchaId = '';

async function refreshCaptcha(imgEl, isLogin) {
  try {
    const res = await fetch('/api/captcha', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      imgEl.textContent = data.code;
      if (isLogin) currentCaptchaId = data.captchaId;
      else currentRegCaptchaId = data.captchaId;
    }
  } catch(e) { /* ignore */ }
}

document.getElementById('loginCaptchaImg').addEventListener('click', function() { refreshCaptcha(this, true); });
document.getElementById('regCaptchaImg').addEventListener('click', function() { refreshCaptcha(this, false); });

// ─── 初始加载验证码 ──────────────────────────────────────
refreshCaptcha(document.getElementById('loginCaptchaImg'), true);
refreshCaptcha(document.getElementById('regCaptchaImg'), false);

// ─── 键盘事件 ────────────────────────────────────────────
document.getElementById('loginPhone').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('loginPassword').focus(); });
document.getElementById('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('loginCaptcha').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('regPhone').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('regPassword').focus(); });
document.getElementById('regPassword').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('regConfirm').focus(); });
document.getElementById('regConfirm').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('regCaptcha').focus(); });
document.getElementById('regCaptcha').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('regInvite').focus(); });
document.getElementById('regInvite').addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); });

loginBtn.addEventListener('click', doLogin);
document.getElementById('registerBtn').addEventListener('click', doRegister);

// ─── 登录 ────────────────────────────────────────────────
async function doLogin() {
  const phone = document.getElementById('loginPhone').value.trim();
  const password = document.getElementById('loginPassword').value;
  const captcha = document.getElementById('loginCaptcha').value.trim();
  const errEl = document.getElementById('loginError');

  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) { errEl.textContent = '请输入有效手机号'; return; }
  if (!password || password.length < 6) { errEl.textContent = '请输入密码（6-12位）'; return; }
  if (!captcha) { errEl.textContent = '请输入验证码'; return; }

  loginBtn.disabled = true; loginBtn.textContent = '登录中...'; errEl.textContent = '';

  try {
    const res = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    const data = await res.json();
    if (!data.success) { errEl.textContent = data.error || '登录失败'; loginBtn.disabled = false; loginBtn.textContent = '登 录'; refreshCaptcha(document.getElementById('loginCaptchaImg'), true); return; }

    currentUser = data.user;
    if (data.needProfile) { showProfilePage(); loginBtn.disabled = false; loginBtn.textContent = '登 录'; return; }
    enterMain();
    goOnline();
  } catch (e) { errEl.textContent = '网络错误'; loginBtn.disabled = false; loginBtn.textContent = '登 录'; }
}

// ─── 注册 ────────────────────────────────────────────────
async function doRegister() {
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirm').value;
  const captcha = document.getElementById('regCaptcha').value.trim();
  const inviteCode = document.getElementById('regInvite').value.trim();
  const errEl = document.getElementById('regError');
  const btn = document.getElementById('registerBtn');

  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) { errEl.textContent = '请输入有效手机号'; return; }
  if (!password || password.length < 6 || password.length > 12) { errEl.textContent = '密码需6-12位'; return; }
  if (password !== confirm) { errEl.textContent = '两次密码不一致'; return; }
  if (!captcha) { errEl.textContent = '请输入验证码'; return; }
  if (!inviteCode) { errEl.textContent = '请输入邀请码'; return; }

  btn.disabled = true; btn.textContent = '注册中...'; errEl.textContent = '';

  try {
    const res = await fetch('/api/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password, captchaId: currentRegCaptchaId, captcha, inviteCode }),
    });
    const data = await res.json();
    if (!data.success) { errEl.textContent = data.error || '注册失败'; btn.disabled = false; btn.textContent = '注 册'; refreshCaptcha(document.getElementById('regCaptchaImg'), false); return; }

    // 自动填入登录
    document.getElementById('loginPhone').value = phone;
    document.getElementById('loginPassword').value = password;
    document.querySelector('[data-tab="login"]').click();
    document.getElementById('loginError').textContent = '注册成功，请登录';
    document.getElementById('loginError').style.color = 'var(--green)';
    btn.disabled = false; btn.textContent = '注 册';
    if (data.needProfile) {
      currentUser = { id: data.userId, phone };
      showProfilePage();
    }
  } catch (e) { errEl.textContent = '网络错误'; btn.disabled = false; btn.textContent = '注 册'; }
}

// ─── 完善资料页 ──────────────────────────────────────────
function showProfilePage() {
  loginPage.classList.remove('active');
  document.getElementById('profilePage').classList.add('active');
  selectedGender = '';
  setupAvatarDataUrl = '';
  document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('setupAvatarChar').textContent = '?';
  document.getElementById('setupAvatarChar').style.display = '';
  document.getElementById('setupAvatar').querySelector('img')?.remove();
}

document.querySelectorAll('.gender-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedGender = btn.dataset.gender;
  });
});

document.getElementById('setupAvatar').addEventListener('click', () => document.getElementById('setupAvatarInput').click());
document.getElementById('setupAvatarInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file || file.size > 2*1024*1024) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    setupAvatarDataUrl = ev.target.result;
    const img = document.createElement('img');
    img.src = setupAvatarDataUrl;
    document.getElementById('setupAvatarChar').style.display = 'none';
    document.getElementById('setupAvatar').querySelector('img')?.remove();
    document.getElementById('setupAvatar').insertBefore(img, document.querySelector('.pp-setup-overlay'));
  };
  reader.readAsDataURL(file);
});

document.getElementById('setupCompleteBtn').addEventListener('click', () => {
  const btn = document.getElementById('setupCompleteBtn');
  const name = document.getElementById('setupName').value.trim() || `用户${(currentUser?.phone||'').slice(-4)}`;
  btn.disabled = true; btn.textContent = '处理中...';
  document.getElementById('setupError').textContent = '';

  // 先上线获取数据
  socket.emit('user-online', currentUser.id, (onlineRes) => {
    if (!onlineRes.success) {
      document.getElementById('setupError').textContent = '连接服务器失败，请重试';
      btn.disabled = false; btn.textContent = '进入 WeTalk'; return;
    }
    // 再保存资料
    socket.emit('complete-profile', {
      userId: currentUser.id, name, gender: selectedGender, avatar: setupAvatarDataUrl,
    }, (res) => {
      if (res.success) {
        currentUser = res.user;
        document.getElementById('profilePage').classList.remove('active');
        loginPage.classList.remove('active');
        mainPage.classList.add('active');
        updateProfileUI();
        contacts = new Map();
        onlineRes.users.forEach(u => contacts.set(u.id, u));
        onlineRes.chats?.forEach(c => { if (c.with && !contacts.has(c.with.id)) contacts.set(c.with.id, c.with); });
        renderContactList(); renderChatList();
        if (onlineRes.chats?.length > 0) {
          openChat(onlineRes.chats[0].with.id);
          socket.emit('get-messages', { with: onlineRes.chats[0].with.id }, (msgs) => {
            messageCache.set(getChatId(currentUser.id, onlineRes.chats[0].with.id), msgs || []);
            renderMessages(); scrollToBottom();
          });
        }
      } else {
        document.getElementById('setupError').textContent = res.error || '保存失败';
        btn.disabled = false; btn.textContent = '进入 WeTalk';
      }
    });
  });
});

// ─── 登录后上线 ──────────────────────────────────────────
function goOnline() {
  socket.emit('user-online', currentUser.id, (res) => {
    if (!res.success) return;
    currentUser = res.user;
    contacts = new Map();
    res.users.forEach(u => contacts.set(u.id, u));
    res.chats?.forEach(c => { if (c.with && !contacts.has(c.with.id)) contacts.set(c.with.id, c.with); });
    updateProfileUI();
    renderContactList();
    renderChatList();
    loadFriends();
    if (res.chats?.length > 0) {
      openChat(res.chats[0].with.id);
      socket.emit('get-messages', { with: res.chats[0].with.id }, (msgs) => {
        const chatId = getChatId(currentUser.id, res.chats[0].with.id);
        messageCache.set(chatId, msgs || []);
        renderMessages(); scrollToBottom();
      });
    }
  });
}

function enterMain() {
  loginPage.classList.remove('active');
  document.getElementById('profilePage')?.classList.remove('active');
  mainPage.classList.add('active');
  updateProfileUI();
}

// ═══════════════════════════════════════════════════════════════
// Socket 事件
// ═══════════════════════════════════════════════════════════════
socket.on('user-online', (user) => {
  contacts.set(user.id, { ...user, online: true });
  renderContactList();
  renderChatList();
  if (activeChat === user.id) updateChatHeader(user.id);
});

socket.on('user-offline', ({ id }) => {
  const user = contacts.get(id);
  if (user) { user.online = false; }
  renderContactList();
  renderChatList();
  if (activeChat === id) updateChatHeader(id);
});

socket.on('user-updated', (user) => {
  contacts.set(user.id, user);
  renderContactList();
  renderChatList();
  if (activeChat === user.id) updateChatHeader(user.id);
  // 如果是当前用户自己的资料更新（如管理员审核通过），刷新 UI
  if (currentUser && user.id === currentUser.id) {
    currentUser = user;
    updateProfileUI();
  }
});

socket.on('new-message', (msg) => {
  const isGroup = msg.to.startsWith('g_');
  const chatId = isGroup ? msg.to : getChatId(msg.from, msg.to);
  if (!messageCache.has(chatId)) messageCache.set(chatId, []);
  messageCache.get(chatId).push(msg);

  const otherId = msg.from === currentUser.id ? msg.to : msg.from;
  if (activeChat === otherId) {
    renderMessages();
    scrollToBottom();
    // 标记已读
    markAsRead(otherId);
  }

  renderChatList();

  if (activeChat !== otherId) {
    const sender = contacts.get(msg.from);
    if (sender && document.hidden) {
      const name = msg.type === 'redpacket' ? '[红包]' : sender.name;
      showNotification(name, msg.type === 'redpacket' ? msg.text : msg.text);
    }
  }
});

socket.on('message-recalled', ({ messageId, chatId, from }) => {
  // 更新本地缓存
  for (const [cid, msgs] of messageCache) {
    const msg = msgs.find(m => m.id === messageId);
    if (msg) {
      msg.type = 'recalled';
      msg.text = '';
      break;
    }
  }
  if (activeChat === from) { renderMessages(); }
  renderChatList();
});

socket.on('message-status', ({ messageId, status }) => {
  // 更新发送者的消息状态（sent → delivered）
  for (const [, msgs] of messageCache) {
    const msg = msgs.find(m => m.id === messageId);
    if (msg) {
      msg.status = status;
      break;
    }
  }
  renderMessages();
});

socket.on('messages-read', ({ by, chatId, count, readAt }) => {
  // 更新本地缓存中的消息状态
  const msgs = messageCache.get(chatId);
  if (msgs) {
    for (const m of msgs) {
      if (m.from === currentUser.id && m.to === by && m.status !== 'read') {
        m.status = 'read';
        m.readAt = readAt;
      }
    }
  }
  if (activeChat === by) { renderMessages(); }
});

socket.on('redpacket-opened', ({ packetId, openedBy, amount }) => {
  // 更新发送者的缓存
  for (const [cid, msgs] of messageCache) {
    const msg = msgs.find(m => m.redpacket?.packetId === packetId);
    if (msg) {
      msg.redpacket.opened = true;
      msg.redpacket.openedAt = Date.now();
      break;
    }
  }
  if (activeChat === openedBy.id) { renderMessages(); }
  renderChatList();
  showToast(`对方领取了您的红包 ¥${amount.toFixed(2)}`);
});

socket.on('group-updated', (group) => {
  if (contacts.has(group.id)) contacts.set(group.id, { ...contacts.get(group.id), name: group.name, avatarColor: group.avatarColor, avatarChar: group.avatarChar });
  if (activeChat === group.id) { const g = myGroups.find(g => g.id === group.id); if (g) Object.assign(g, group); updateChatHeader(group.id); }
  renderChatList();
});

socket.on('group-disbanded', ({ groupId }) => {
  myGroups = myGroups.filter(g => g.id !== groupId); contacts.delete(groupId);
  if (activeChat === groupId) { activeChat = null; chatWindow.style.display = 'none'; emptyState.style.display = 'flex'; }
  renderChatList(); renderContactList(); showToast('群已解散');
});

socket.on('new-friend-request', ({ from }) => {
  showToast(`来自 ${from?.name || '用户'} 的好友请求`);
  loadFriends();
});

socket.on('friend-added', ({ user }) => {
  if (user) contacts.set(user.id, user);
  loadFriends();
  renderContactList();
});

socket.on('user-typing', ({ from, name }) => {
  if (activeChat === from) {
    typingIndicator.innerHTML = `${escapeHtml(name)} <span class="typing-dots"><span></span><span></span><span></span></span>`;
  }
});

socket.on('user-stop-typing', ({ from }) => {
  if (activeChat === from) { typingIndicator.textContent = ''; }
});

// ═══════════════════════════════════════════════════════════════
// 搜索用户
// ═══════════════════════════════════════════════════════════════
let searchTimeout = null;
searchUserInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const q = searchUserInput.value.trim();
    if (!q) { searchResults.innerHTML = ''; return; }
    socket.emit('search-users', q, (users) => {
      searchResults.innerHTML = users.map(u => {
        const avatarHtml = u.avatar
          ? `<img src="${u.avatar}" alt="">`
          : u.avatarChar;
        return `
        <div class="search-result-item">
          <div class="avatar" style="background:${u.avatarColor || '#666'}">${avatarHtml}</div>
          <div class="info">
            <div class="name">${escapeHtml(u.name)}</div>
            <div class="status">${u.online ? '在线' : '离线'}${u.realNameVerified ? ' · 已实名' : ''}</div>
          </div>
          <button class="add-btn" onclick="startChat('${u.id}')">聊天</button>
        </div>
      `}).join('') || '<p style="color:#999;font-size:.82rem;text-align:center;padding:1rem">未找到用户</p>';
    });
  }, 300);
});

// ═══════════════════════════════════════════════════════════════
// 添加联系人
// ═══════════════════════════════════════════════════════════════
addContactBtn2.addEventListener('click', () => {
  showBsModal(addContactModal);
  searchUserInput.value = '';
  searchResults.innerHTML = '';
  searchUserInput.focus();
});
modalOverlay.onclick = modalClose.onclick = () => {
  hideBsModal(addContactModal);
};

// ─── 创建群聊 ─────────────────────────────────────────────
createGroupBtn.addEventListener('click', () => {
  cgNameInput.value = '';
  cgSearchInput.value = '';
  renderCgContactList(Array.from(contacts.values()).filter(c => c.id !== currentUser.id));
  showBsModal(createGroupModal);
  cgNameInput.focus();
});
cgModalOverlay.onclick = cgModalClose.onclick = () => hideBsModal(createGroupModal);

const cgSelected = new Set();
function renderCgContactList(items) {
  cgContactList.innerHTML = items.map(c => {
    const sel = cgSelected.has(c.id);
    return `
      <div class="cg-contact-item ${sel ? 'selected' : ''}" data-id="${c.id}">
        <div class="avatar" style="background:${c.avatarColor||'#666'}">${c.avatarChar||'?'}</div>
        <span class="cg-name">${escapeHtml(c.name)}</span>
        <div class="cg-check"></div>
      </div>`;
  }).join('');
  cgContactList.querySelectorAll('.cg-contact-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      if (cgSelected.has(id)) cgSelected.delete(id); else cgSelected.add(id);
      el.classList.toggle('selected');
    });
  });
}

cgSearchInput.addEventListener('input', () => {
  const q = cgSearchInput.value.trim().toLowerCase();
  const items = Array.from(contacts.values()).filter(c =>
    c.id !== currentUser.id && c.name.toLowerCase().includes(q)
  );
  renderCgContactList(items);
});

cgCreateBtn.addEventListener('click', () => {
  const name = cgNameInput.value.trim();
  if (!name) { showToast('请输入群名称'); return; }
  if (cgSelected.size < 1) { showToast('请选择至少一位群成员'); return; }
  cgCreateBtn.disabled = true;
  cgCreateBtn.textContent = '创建中...';
  socket.emit('create-group', { name, memberIds: [...cgSelected] }, (res) => {
    cgCreateBtn.disabled = false;
    cgCreateBtn.textContent = '创建群聊';
    if (res.success) {
      cgSelected.clear();
      hideBsModal(createGroupModal);
      myGroups.push(res.group);
      // 把群加入到 contacts 中用于聊天列表
      contacts.set(res.group.id, {
        id: res.group.id, name: res.group.name,
        avatar: null, avatarColor: res.group.avatarColor, avatarChar: res.group.avatarChar,
        online: true,
      });
      openChat(res.group.id);
      showToast('群聊创建成功');
    } else {
      showToast(res.error || '创建失败');
    }
  });
});

// ─── 群信息弹窗 ───────────────────────────────────────────
function openGroupInfo(groupId) {
  socket.emit('get-group-info', groupId, (res) => {
    if (!res.success) { showToast(res.error || '获取群信息失败'); return; }
    const g = res.group;
    giAvatar.textContent = g.avatarChar || '群';
    giAvatar.style.background = g.avatarColor || '#3498db';
    giName.textContent = `${g.name}（${g.memberCount}人）`;
    giCount.textContent = `${g.memberCount} 位成员`;

    const me = g.members.find(m => m.userId === currentUser.id);
    const isOwner = me?.role === 'owner';
    const isAdmin = me?.role === 'admin';

    // 群公告
    let html = '<div style="margin:.5rem 0;padding:.5rem;background:rgba(255,255,255,.04);border-radius:8px;font-size:.78rem;color:#aaa">';
    html += g.notice ? `📢 ${escapeHtml(g.notice)}` : '暂无群公告';
    if (isOwner || isAdmin) html += `<br><span id="editNoticeBtn" style="color:var(--green);cursor:pointer;font-size:.72rem">编辑公告</span>`;
    html += '</div>';
    // 操作按钮
    html += '<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.5rem">';
    if (isOwner || isAdmin) html += '<button class="gi-action-btn" onclick="showToast(\'搜索群名称让好友加入\')">➕ 添加</button>';
    if (isOwner) html += `<button class="gi-action-btn" onclick="doMuteAll('${g.id}')">🔇 全员禁言</button>`;
    if (isOwner) html += `<button class="gi-action-btn" onclick="doTransferGroup('${g.id}')">🔄 转让群</button>`;
    if (isOwner) html += `<button class="gi-action-btn" style="color:var(--danger)" onclick="doDisbandGroup('${g.id}')">🗑 解散群</button>`;
    html += '</div>';
    giActions.innerHTML = html;

    document.getElementById('editNoticeBtn')?.addEventListener('click', () => {
      const n = prompt('输入群公告：', g.notice || '');
      if (n !== null) socket.emit('set-group-notice', { groupId: g.id, notice: n }, (r) => { if(r.success)openGroupInfo(g.id); });
    });

    giMembers.innerHTML = (g.memberDetails || []).map(m => {
      const rl = m.role==='owner'?'👑群主':(m.role==='admin'?'管理员':'');
      const cr = (isOwner&&m.role!=='owner')||(isAdmin&&m.role==='member');
      const csa = isOwner&&m.role==='member';
      const nm = m.user?.name||m.userId;
      const ah = m.user?.avatar?`<img src="${m.user.avatar}">`:(m.user?.avatarChar||'?'); const ab = m.user?.avatar?'':(m.user?.avatarColor||'#666');
      return `<div class="gi-member"><div class="avatar" style="background:${ab}">${ah}</div><span class="gi-member-name">${escapeHtml(nm)}</span><span class="gi-member-role">${rl}</span>${csa?`<button class="gi-member-action" onclick="doSetRole('${g.id}','${m.userId}','admin')">设为管理</button>`:''}${cr?`<button class="gi-member-action" onclick="doRemoveMember('${g.id}','${m.userId}')">移除</button>`:''}</div>`;
    }).join('');
    showBsModal(groupInfoModal);
  });
}
window.openGroupInfo = openGroupInfo;

function doMuteAll(gid){if(confirm('全员禁言？（仅群主可发言）'))socket.emit('group-mute-all',{groupId:gid,muted:true},r=>showToast(r.success?'已禁言':(r.error||'失败')));}
window.doMuteAll=doMuteAll;
function doTransferGroup(gid){
  const n=prompt('输入新群主的用户ID/昵称：');if(!n)return;
  socket.emit('get-group-info',gid,r=>{
    if(!r.success)return;
    const m=r.group.memberDetails?.find(m=>m.user?.name?.includes(n)||m.userId.includes(n));
    if(!m){showToast('未找到该成员');return;}
    if(confirm(`转让给 ${m.user?.name||m.userId}？`))socket.emit('transfer-group',{groupId:gid,toUserId:m.userId},r=>showToast(r.success?'已转让':(r.error||'失败')));
  });
}
window.doTransferGroup=doTransferGroup;
function doDisbandGroup(gid){if(confirm('确定解散此群？不可撤销！'))socket.emit('disband-group',{groupId:gid},r=>{if(r.success){showToast('群已解散');hideBsModal(groupInfoModal);}else showToast(r.error||'失败');});}
window.doDisbandGroup=doDisbandGroup;

giModalOverlay.onclick = giModalClose.onclick = () => hideBsModal(groupInfoModal);

function doSetRole(groupId, userId, role) {
  socket.emit('set-group-role', { groupId, userId, role }, (res) => {
    if (res.success) showToast('已设置管理员');
    else showToast(res.error || '操作失败');
    openGroupInfo(groupId);
  });
}
window.doSetRole = doSetRole;

function doRemoveMember(groupId, userId) {
  if (!confirm('确定移除此成员？')) return;
  socket.emit('remove-group-member', { groupId, userId }, (res) => {
    if (res.success) { showToast('已移除'); openGroupInfo(groupId); }
    else showToast(res.error || '操作失败');
  });
}
window.doRemoveMember = doRemoveMember;

// ═══════════════════════════════════════════════════════════════
// 退出登录
// ═══════════════════════════════════════════════════════════════
function doLogout() {
  if (confirm('确定退出登录？')) {
    socket.disconnect();
    location.reload();
  }
}
logoutBtn.addEventListener('click', doLogout);
ppLogout.addEventListener('click', doLogout);

// ═══════════════════════════════════════════════════════════════
// Tab 切换
// ═══════════════════════════════════════════════════════════════
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    chatList.classList.toggle('active', target === 'chats');
    contactList.classList.toggle('active', target === 'contacts');
    profilePanel.classList.toggle('active', target === 'profile');
    if (target === 'profile') updateProfileUI();
  });
});

// ═══════════════════════════════════════════════════════════════
// 搜索聊天
// ═══════════════════════════════════════════════════════════════
searchChat.addEventListener('input', () => {
  const q = searchChat.value.trim().toLowerCase();
  document.querySelectorAll('.chat-item, .contact-item').forEach(el => {
    const name = el.querySelector('.chat-item-name, .contact-name')?.textContent?.toLowerCase() || '';
    el.style.display = name.includes(q) ? 'flex' : 'none';
  });
});

// ═══════════════════════════════════════════════════════════════
// 聊天列表渲染
// ═══════════════════════════════════════════════════════════════
function renderChatList() {
  const items = [];
  for (const [id, user] of contacts) {
    if (id === currentUser.id) continue;
    const chatId = getChatId(currentUser.id, id);
    const msgs = messageCache.get(chatId) || [];
    const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
    const unread = msgs.filter(m => m.from === id && m.to === currentUser.id && m.status !== 'read').length;
    items.push({ user, lastMsg, unread, time: lastMsg?.time || 0 });
  }
  items.sort((a, b) => b.time - a.time);

  chatList.innerHTML = items.map(c => {
    const u = c.user;
    const chatId = getChatId(currentUser.id, u.id);
    const settings = getLocalChatSettings(chatId);
    const avatarHtml = u.avatar ? `<img src="${u.avatar}" alt="">` : (u.avatarChar || '?');
    const avatarBg = u.avatar ? '' : (u.avatarColor || '#666');
    const lastText = !c.lastMsg ? '暂无消息'
      : c.lastMsg.type === 'recalled' ? (c.lastMsg.from === currentUser.id ? '你撤回了一条消息' : '对方撤回了一条消息')
      : c.lastMsg.type === 'redpacket' ? (c.lastMsg.redpacket?.opened ? '已领取红包' : '🧧 红包')
      : escapeHtml(c.lastMsg.text.slice(0, 30)) + (c.lastMsg.text.length > 30 ? '...' : '');
    const timeStr = c.lastMsg ? formatTime(c.lastMsg.time) : '';
    const isActive = activeChat === u.id;

    return `
      <div class="chat-item ${isActive ? 'active' : ''}" onclick="openChat('${u.id}')" data-pinned="${settings?.pinned ? '1' : '0'}">
        <div class="avatar" style="background:${avatarBg}">
          ${avatarHtml}
          <span class="online-dot ${u.online ? '' : 'offline'}"></span>
        </div>
        <div class="chat-item-info">
          <div class="chat-item-name">${escapeHtml(u.name)} ${settings?.pinned ? '📌' : ''} ${settings?.muted ? '🔇' : ''}</div>
          <div class="chat-item-preview">${lastText}</div>
        </div>
        <div class="chat-item-right">
          <div class="chat-item-time">${timeStr}</div>
          ${c.unread > 0 && !settings?.muted ? `<div class="unread-badge badge bg-danger rounded-pill">${c.unread > 99 ? '99+' : c.unread}</div>` : ''}
          <div style="display:flex;gap:2px;margin-top:4px">
            <span class="chat-action-btn" onclick="event.stopPropagation();togglePin('${u.id}')" title="${settings?.pinned ? '取消置顶' : '置顶'}">📌</span>
            <span class="chat-action-btn" onclick="event.stopPropagation();toggleMute('${u.id}')" title="${settings?.muted ? '取消免打扰' : '免打扰'}">🔇</span>
            <span class="chat-action-btn" onclick="event.stopPropagation();deleteChat('${u.id}')" title="删除聊天">🗑</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 置顶聊天排最前
  const parent = chatList;
  const pinnedItems = parent.querySelectorAll('[data-pinned="1"]');
  pinnedItems.forEach(el => parent.insertBefore(el, parent.firstChild));

  if (items.length === 0) {
    chatList.innerHTML = `
      <div style="text-align:center;padding:2rem 1rem;color:#666;font-size:.82rem">
        <p style="font-size:2rem;margin-bottom:.5rem">💬</p>
        <p>暂无聊天记录</p>
        <p style="margin-top:.3rem;font-size:.75rem;color:#888">点击右上角 ➕ 添加好友</p>
      </div>`;
  }
}

// ═══════════════════════════════════════════════════════════════
// 联系人列表渲染
// ═══════════════════════════════════════════════════════════════
let myFriends = [];       // 好友列表
let pendingReqs = [];     // 好友申请列表

function loadFriends() {
  socket.emit('get-friends', (list) => { myFriends = list || []; renderContactList(); });
  socket.emit('get-friend-requests', (list) => { pendingReqs = list || []; renderContactList(); });
}

function renderContactList() {
  contactList.innerHTML = '';

  // 新的朋友
  const pendingCount = pendingReqs.filter(r => r.status === 'pending').length;
  const frHtml = `
    <div class="contact-item" id="newFriendsBtn" style="cursor:pointer">
      <div class="avatar" style="background:#f90;border-radius:50%">👤</div>
      <div style="flex:1;min-width:0">
        <div class="contact-name">新的朋友</div>
        <div class="contact-status">${pendingCount > 0 ? pendingCount + '个待处理' : '暂无申请'}</div>
      </div>
      ${pendingCount > 0 ? `<div class="unread-badge badge bg-danger rounded-pill">${pendingCount}</div>` : ''}
    </div>`;
  contactList.innerHTML += frHtml;

  // 好友列表 A-Z 排序
  if (myFriends.length === 0) {
    contactList.innerHTML += `<div style="text-align:center;padding:1.5rem 1rem;color:#666;font-size:.78rem"><p>暂无好友，点击上方「新的朋友」搜索添加</p></div>`;
  } else {
    const sorted = [...myFriends].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    let lastLetter = '';
    sorted.forEach(u => {
      const letter = u.name.charAt(0).toUpperCase();
      if (letter !== lastLetter) {
        contactList.innerHTML += `<div style="padding:.4rem .8rem .2rem;font-size:.72rem;color:#666;font-weight:600">${letter}</div>`;
        lastLetter = letter;
      }
      const avatarHtml = u.avatar ? `<img src="${u.avatar}" alt="">` : (u.avatarChar || '?');
      const avatarBg = u.avatar ? '' : (u.avatarColor || '#666');
      contactList.innerHTML += `
        <div class="contact-item" onclick="openChat('${u.id}')">
          <div class="avatar" style="background:${avatarBg}">${avatarHtml}<span class="online-dot ${u.online ? '' : 'offline'}"></span></div>
          <div style="flex:1;min-width:0">
            <div class="contact-name">${escapeHtml(u.name)} ${u.realNameVerified ? '<span style="font-size:.6rem;color:#1aad19">✓</span>' : ''}</div>
            <div class="contact-status">${u.online ? '在线' : '离线'}</div>
          </div>
        </div>`;
    });
  }

  // 群聊列表
  if (myGroups.length > 0) {
    contactList.innerHTML += `<div style="padding:.5rem .8rem .2rem;font-size:.72rem;color:#666;font-weight:600;border-top:1px solid rgba(255,255,255,.05);margin-top:.3rem">群聊 (${myGroups.length})</div>`;
    myGroups.forEach(g => {
      contactList.innerHTML += `
        <div class="contact-item" onclick="openChat('${g.id}')">
          <div class="avatar" style="background:${g.avatarColor||'#3498db'}">${g.avatarChar||'群'}</div>
          <div style="flex:1;min-width:0">
            <div class="contact-name">${escapeHtml(g.name)}</div>
            <div class="contact-status">${g.memberCount||'?'}人</div>
          </div>
        </div>`;
    });
  }
}

// 点击新的朋友
document.addEventListener('click', (e) => {
  const frBtn = document.getElementById('newFriendsBtn');
  if (frBtn && (frBtn === e.target || frBtn.contains(e.target))) {
    showFriendRequests();
  }
});

function showFriendRequests() {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('friendRequestPage').classList.add('active');
  renderFriendRequests();
}

document.getElementById('frBackBtn').addEventListener('click', () => {
  document.getElementById('friendRequestPage').classList.remove('active');
  document.querySelector('[data-tab="contacts"]')?.click();
});

function renderFriendRequests() {
  const el = document.getElementById('friendRequestList');
  const all = pendingReqs || [];
  const pending = all.filter(r => r.status === 'pending');
  const history = all.filter(r => r.status !== 'pending');

  let html = '<p style="font-size:.82rem;color:#888;margin-bottom:.5rem">搜索用户添加好友</p>';
  html += `<div style="display:flex;gap:.3rem;margin-bottom:.8rem">
    <input type="text" id="frSearchInput" placeholder="输入手机号搜索..." style="flex:1;padding:.4rem .6rem;border-radius:6px;border:1px solid #444;background:#3a3a3a;color:#ddd;font-size:.8rem;outline:none">
    <button id="frSearchBtn" style="padding:.4rem .7rem;border:none;border-radius:6px;background:var(--green);color:#fff;font-size:.78rem;cursor:pointer">搜索</button>
  </div>
  <div id="frSearchResult" style="margin-bottom:.5rem"></div>`;

  if (pending.length > 0) {
    html += `<div style="font-size:.78rem;color:#888;margin:.3rem 0">待处理 (${pending.length})</div>`;
    pending.forEach(r => {
      const u = r.fromUser || { name: r.from, avatarChar: '?', avatarColor: '#666' };
      html += `
        <div style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0;border-bottom:1px solid rgba(255,255,255,.04)">
          <div class="avatar" style="width:34px;height:34px;background:${u.avatarColor||'#666'};font-size:.7rem">${u.avatarChar||'?'}</div>
          <div style="flex:1"><div style="font-size:.82rem">${escapeHtml(u.name||r.from)}</div><div style="font-size:.7rem;color:#888">${escapeHtml(r.remark||'')}</div></div>
          <button class="add-btn" onclick="acceptFriend('${r.from}')" style="padding:.2rem .5rem;border:none;border-radius:6px;background:var(--green);color:#fff;font-size:.72rem;cursor:pointer">同意</button>
          <button class="add-btn" onclick="rejectFriend('${r.from}')" style="padding:.2rem .5rem;border:none;border-radius:6px;background:#888;color:#fff;font-size:.72rem;cursor:pointer">拒绝</button>
        </div>`;
    });
  } else {
    html += `<div style="text-align:center;padding:.8rem;color:#888;font-size:.78rem">暂无好友申请</div>`;
  }

  if (history.length > 0) {
    html += `<div style="font-size:.78rem;color:#888;margin:.5rem 0 .3rem">历史记录</div>`;
    history.forEach(r => {
      const u = r.fromUser || { name: r.from, avatarChar: '?', avatarColor: '#666' };
      const statusLabel = r.status === 'accepted' ? '已添加' : '已拒绝';
      html += `
        <div style="display:flex;align-items:center;gap:.5rem;padding:.3rem 0;opacity:.6">
          <div class="avatar" style="width:30px;height:30px;background:${u.avatarColor||'#666'};font-size:.65rem">${u.avatarChar||'?'}</div>
          <div style="flex:1"><div style="font-size:.78rem">${escapeHtml(u.name||r.from)}</div></div>
          <span style="font-size:.7rem;color:#888">${statusLabel}</span>
        </div>`;
    });
  }

  el.innerHTML = html;

  // 搜索
  document.getElementById('frSearchBtn')?.addEventListener('click', () => {
    const q = document.getElementById('frSearchInput').value.trim();
    if (!q) return;
    socket.emit('search-users', q, (users) => {
      const resultEl = document.getElementById('frSearchResult');
      if (!users || users.length === 0) { resultEl.innerHTML = '<p style="font-size:.75rem;color:#888;padding:.3rem 0">未找到用户</p>'; return; }
      resultEl.innerHTML = users.map(u => {
        const isFriend = myFriends.some(f => f.id === u.id);
        return `
          <div style="display:flex;align-items:center;gap:.5rem;padding:.3rem 0">
            <div class="avatar" style="width:32px;height:32px;background:${u.avatarColor||'#666'};font-size:.7rem">${u.avatarChar||'?'}</div>
            <div style="flex:1;font-size:.8rem">${escapeHtml(u.name)}</div>
            ${isFriend ? '<span style="font-size:.7rem;color:#888">已是好友</span>' : `<button class="add-btn" onclick="sendFriendReq('${u.id}')" style="padding:.2rem .5rem;border:none;border-radius:6px;background:var(--green);color:#fff;font-size:.72rem;cursor:pointer">添加</button>`}
          </div>`;
      }).join('');
    });
  });
}

function sendFriendReq(userId) {
  socket.emit('send-friend-request', { to: userId, remark: '' }, (res) => {
    if (res.success) showToast('已发送好友请求');
    else showToast(res.error || '发送失败');
  });
}
window.sendFriendReq = sendFriendReq;

function acceptFriend(from) {
  socket.emit('accept-friend-request', { from }, (res) => {
    if (res.success) { showToast('已添加好友'); loadFriends(); }
    else showToast(res.error || '操作失败');
  });
}
window.acceptFriend = acceptFriend;

function rejectFriend(from) {
  socket.emit('reject-friend-request', { from }, (res) => {
    if (res.success) { showToast('已拒绝'); loadFriends(); }
    else showToast(res.error || '操作失败');
  });
}
window.rejectFriend = rejectFriend;

// ═══════════════════════════════════════════════════════════════
// 打开聊天
// ═══════════════════════════════════════════════════════════════
function openChat(userId) {
  activeChat = userId;
  const user = contacts.get(userId);
  if (!user) return;
  const isGroup = userId.startsWith('g_');

  if (!isGroup) clearUnread(userId);
  emptyState.style.display = 'none';
  chatWindow.style.display = 'flex';
  updateChatHeader(userId);
  renderChatList();
  renderContactList();

  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.add('with-chat');
    document.querySelector('.chat-area').classList.add('with-chat');
  }

  if (isGroup) {
    if (!messageCache.has(userId) || messageCache.get(userId).length === 0) {
      socket.emit('get-messages', { with: userId }, (msgs) => {
        messageCache.set(userId, msgs || []);
        renderMessages();
        scrollToBottom();
      });
    } else {
      renderMessages();
      scrollToBottom();
    }
  } else {
    const chatId = getChatId(currentUser.id, userId);
    if (!messageCache.has(chatId) || messageCache.get(chatId).length === 0) {
      socket.emit('get-messages', { with: userId }, (msgs) => {
        messageCache.set(chatId, msgs || []);
        renderMessages();
        scrollToBottom();
        markAsRead(userId);
      });
    } else {
      renderMessages();
      scrollToBottom();
      markAsRead(userId);
    }
  }
}
window.openChat = openChat;

function startChat(userId) {
  hideBsModal(addContactModal);
  if (!contacts.has(userId)) {
    // 获取用户资料
    socket.emit('get-profile', userId, (user) => {
      if (user) {
        contacts.set(userId, user);
        openChat(userId);
      }
    });
  } else {
    openChat(userId);
  }
}
window.startChat = startChat;

function clearUnread(userId) {
  const chatId = getChatId(currentUser.id, userId);
  const msgs = messageCache.get(chatId);
  if (msgs) {
    let changed = false;
    msgs.forEach(m => {
      if (m.from === userId && m.to === currentUser.id && m.status !== 'read') {
        m.status = 'read';
        m.readAt = Date.now();
        changed = true;
      }
    });
    // 通知服务端
    if (changed) {
      socket.emit('mark-read', { from: userId });
    }
  }
}

function markAsRead(userId) {
  const chatId = getChatId(currentUser.id, userId);
  const msgs = messageCache.get(chatId);
  if (!msgs) return;
  let changed = false;
  for (const m of msgs) {
    if (m.from === userId && m.to === currentUser.id && m.status !== 'read') {
      m.status = 'read';
      m.readAt = Date.now();
      changed = true;
    }
  }
  if (changed) {
    socket.emit('mark-read', { from: userId });
    renderMessages();
  }
}

function updateChatHeader(userId) {
  const user = contacts.get(userId);
  if (!user) return;
  const isGroup = userId.startsWith('g_');
  const avatarHtml = user.avatar
    ? `<img src="${user.avatar}" alt="">`
    : (user.avatarChar || '?');
  const avatarBg = user.avatar ? '' : (user.avatarColor || '#666');
  chatAvatar.innerHTML = avatarHtml;
  chatAvatar.style.background = avatarBg;
  chatName.textContent = user.name;
  if (isGroup) {
    chatStatus.textContent = '群聊';
    chatStatus.style.color = '#888';
    // 设置群信息按钮
    chatAvatar.style.cursor = 'pointer';
    chatAvatar.onclick = () => openGroupInfo(userId);
  } else {
    chatAvatar.style.cursor = '';
    chatAvatar.onclick = null;
    chatStatus.textContent = user.online ? '在线' : '离线';
    chatStatus.style.color = user.online ? '#1aad19' : '#888';
  }
}

// ═══════════════════════════════════════════════════════════════
// 消息渲染
// ═══════════════════════════════════════════════════════════════
function renderMessages() {
  if (!activeChat) return;
  const isGroup = activeChat.startsWith('g_');
  const chatId = isGroup ? activeChat : getChatId(currentUser.id, activeChat);
  const msgs = messageCache.get(chatId) || [];
  const user = contacts.get(activeChat);

  // 按时间分组添加日期分割
  let lastDate = '';
  let html = '';

  // 加载更多按钮（如果有超过20条）
  if (msgs.length > 20) {
    html += `<div class="load-more" onclick="alert('查看更多消息')">查看更多消息</div>`;
  }

  msgs.forEach(m => {
    const msgDate = new Date(m.time).toDateString();
    if (msgDate !== lastDate) {
      html += `<div class="date-divider"><span>${formatDate(m.time)}</span></div>`;
      lastDate = msgDate;
    }
    html += renderMessageHtml(m, user, activeChat.startsWith('g_'));
  });

  messagesContainer.innerHTML = html;

  // 绑定红包点击事件
  messagesContainer.querySelectorAll('.rp-bubble').forEach(el => {
    el.addEventListener('click', () => {
      const msgId = el.dataset.msgId;
      const msgs = messageCache.get(chatId) || [];
      const msg = msgs.find(m => m.id === msgId);
      if (msg && msg.type === 'redpacket') {
        handleRedpacketClick(msg);
      }
    });
  });

  // 绑定撤回点击事件
  messagesContainer.querySelectorAll('.recall-action').forEach(el => {
    el.addEventListener('click', () => {
      const msgId = el.dataset.msgId;
      recallMessage(msgId);
    });
  });
}

function renderMessageHtml(m, chatPartner, isGroup) {
  const isMine = m.from === currentUser.id;
  const sender = isMine ? currentUser : chatPartner;
  const senderName = isGroup && !isMine ? (contacts.get(m.from)?.name || m.from) : null;
  const avatarHtml = sender?.avatar
    ? `<img src="${sender.avatar}" alt="">`
    : (sender?.avatarChar || '?');
  const avatarBg = sender?.avatar ? '' : (sender?.avatarColor || '#999');
  const timeStr = formatTime(m.time);

  // 撤回消息
  if (m.type === 'recalled') {
    const recallText = isMine ? '你撤回了一条消息' : '对方撤回了一条消息';
    const elapsed = Date.now() - m.time;
    const canReEdit = isMine && elapsed <= 60000; // 1分钟内可重新编辑
    return `
      <div class="message-row recalled" data-msg-id="${m.id}" data-chat-id="${getChatId(currentUser.id, activeChat)}">
        <div class="message-body" style="max-width:100%">
          <div class="message-bubble">${recallText}</div>
          <div style="display:flex;align-items:center;gap:.5rem;justify-content:center;margin-top:2px">
            <span class="recall-hint">${timeStr}</span>
            ${canReEdit ? `<span class="recall-hint recall-action" data-msg-id="${m.id}" style="cursor:pointer;color:#1aad19">重新编辑</span>` : ''}
          </div>
        </div>
      </div>`;
  }

  // 红包消息
  if (m.type === 'redpacket') {
    const opened = m.redpacket?.opened;
    const statusText = opened
      ? `已领取`
      : (isMine ? (m.status === 'delivered' || m.status === 'read' ? '等待领取' : '已发送') : '点击领取');
    return `
      <div class="message-row ${isMine ? 'mine' : 'other'}" data-msg-id="${m.id}" data-chat-id="${getChatId(currentUser.id, activeChat)}">
        <div class="message-avatar" style="background:${avatarBg}">${avatarHtml}</div>
        <div class="message-body">
          <div class="rp-bubble" data-msg-id="${m.id}">
            <div class="rp-bubble-icon">🧧</div>
            <div class="rp-bubble-info">
              <div class="rp-bubble-title">${escapeHtml(m.text)}</div>
              <div class="rp-bubble-sub">${isMine ? '你发了一个红包' : '红包'}</div>
              <div class="rp-bubble-status">${statusText}</div>
            </div>
            <div class="rp-bubble-amount">${opened ? '已拆开' : '?'}</div>
          </div>
          <div class="message-footer">
            <span class="message-time">${timeStr}</span>
          </div>
        </div>
      </div>`;
  }

  // 普通文本消息
  const statusIcon = isMine ? getStatusSvg(m.status) : '';
  return `
    <div class="message-row ${isMine ? 'mine' : 'other'}" data-msg-id="${m.id}" data-chat-id="${getChatId(currentUser.id, activeChat)}">
      <div class="message-avatar" style="background:${avatarBg}">${avatarHtml}</div>
      <div class="message-body">
        ${senderName ? `<div style="font-size:.7rem;color:#888;margin-bottom:1px;padding-left:2px">${escapeHtml(senderName)}</div>` : ''}
        <div class="message-bubble">${escapeHtml(m.text || '')}</div>
        <div class="message-footer">
          <span class="message-time">${timeStr}</span>
          ${statusIcon}
          ${isMine && canRecall(m) ? `<span class="recall-action" data-msg-id="${m.id}" style="font-size:.6rem;color:#999;cursor:pointer;margin-left:2px">撤回</span>` : ''}
        </div>
      </div>
    </div>`;
}

function getStatusSvg(status) {
  // ✓ 已发送（灰色单勾）| ✓✓ 已送达（灰色双勾）| ✓✓ 已读（蓝色双勾）
  if (status === 'sent') {
    return '<span class="msg-status sent"><svg viewBox="0 0 16 16" width="14" height="14"><path d="M13.5 4.5L6 12l-3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  }
  if (status === 'delivered') {
    return '<span class="msg-status delivered"><svg viewBox="0 0 22 16" width="18" height="14"><path d="M13 4.5L7 11 4.5 8.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 4.5L13 11l-2.5-2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity=".5"/></svg></span>';
  }
  if (status === 'read') {
    return '<span class="msg-status read"><svg viewBox="0 0 22 16" width="18" height="14"><path d="M13 4.5L7 11 4.5 8.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 4.5L13 11l-2.5-2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  }
  return '';
}

function canRecall(msg) {
  if (msg.from !== currentUser.id) return false;
  if (msg.type !== 'text') return false;
  return (Date.now() - msg.time) < 180000; // 3分钟
}

function scrollToBottom() {
  setTimeout(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, 20);
}

// ═══════════════════════════════════════════════════════════════
// 发送消息
// ═══════════════════════════════════════════════════════════════
function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !activeChat) return;

  socket.emit('send-message', { to: activeChat, text }, (msg) => {
    const chatId = getChatId(currentUser.id, activeChat);
    if (!messageCache.has(chatId)) messageCache.set(chatId, []);
    messageCache.get(chatId).push(msg);
    renderMessages();
    scrollToBottom();
    renderChatList();
  });

  messageInput.value = '';
  emojiPanel.style.display = 'none';
  updateSendBtn();
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
messageInput.addEventListener('input', updateSendBtn);

function updateSendBtn() {
  sendBtn.disabled = !messageInput.value.trim();
}

// ─── 右键菜单 / 回复 / 转发 / 收藏 ──────────────────────
let ctxMsgId = null, ctxMsgChatId = null, replyToMsg = null;
document.addEventListener('contextmenu', (e) => {
  const bubble = e.target.closest('.message-bubble, .rp-bubble');
  if (!bubble) { document.getElementById('contextMenu').style.display = 'none'; return; }
  e.preventDefault();
  const row = bubble.closest('.message-row');
  ctxMsgId = row?.dataset?.msgId; ctxMsgChatId = row?.dataset?.chatId;
  if (!ctxMsgId) return;
  const menu = document.getElementById('contextMenu');
  menu.style.left = Math.min(e.clientX, window.innerWidth - 140) + 'px';
  menu.style.top = Math.min(e.clientY, window.innerHeight - 200) + 'px';
  menu.style.display = 'block';
  document.getElementById('ctxDelete').style.display = row?.classList.contains('mine') ? 'block' : 'none';
});
document.addEventListener('click', () => document.getElementById('contextMenu').style.display = 'none');

document.getElementById('ctxReply').onclick = () => {
  const msgs = messageCache.get(ctxMsgChatId)||[]; const msg = msgs.find(m=>m.id===ctxMsgId);
  if (msg) { replyToMsg = msg; showQuoteBar(msg); }
};
document.getElementById('ctxForward').onclick = () => {
  showBsModal(document.getElementById('forwardModal'));
  renderForwardList(myFriends); document.getElementById('fwSearch').value=''; document.getElementById('fwSearch').focus();
};
document.getElementById('ctxFavorite').onclick = () => {
  socket.emit('favorite-message', { messageId: ctxMsgId, chatId: ctxMsgChatId }, (r) => showToast(r.success?'已收藏':(r.error||'失败')));
};
document.getElementById('ctxCopy').onclick = () => {
  const msgs = messageCache.get(ctxMsgChatId)||[]; const msg = msgs.find(m=>m.id===ctxMsgId);
  if (msg?.text) navigator.clipboard.writeText(msg.text).then(()=>showToast('已复制'));
};
document.getElementById('ctxDelete').onclick = () => {
  if (!confirm('删除此消息？')) return;
  const msgs = messageCache.get(ctxMsgChatId); if (!msgs) return;
  const idx = msgs.findIndex(m=>m.id===ctxMsgId); if(idx>-1) msgs.splice(idx,1); renderMessages();
};

function showQuoteBar(msg) {
  document.getElementById('quoteBar')?.remove();
  const bar = document.createElement('div'); bar.id='quoteBar';
  bar.style.cssText='display:flex;align-items:center;padding:.3rem .6rem;background:#e8f5e9;border-left:3px solid var(--green);font-size:.78rem;color:#555;gap:.5rem;flex-shrink:0';
  bar.innerHTML=`<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">回复：${escapeHtml((msg.text||'').slice(0,40))}</span><span id="cancelReply" style="cursor:pointer;font-size:1rem;opacity:.5">✕</span>`;
  document.querySelector('.input-area').before(bar);
  document.getElementById('cancelReply').onclick=()=>{bar.remove();replyToMsg=null;};
}
// 重写 sendMessage 支持回复
sendMessage = function() {
  const text = messageInput.value.trim();
  if (!text || !activeChat) return;
  const replyText = replyToMsg ? `「${(replyToMsg.text||'').slice(0,20)}」\n` : '';
  socket.emit('send-message', { to: activeChat, text: replyText + text }, (msg) => {
    const chatId = activeChat.startsWith('g_') ? activeChat : getChatId(currentUser.id, activeChat);
    if (!messageCache.has(chatId)) messageCache.set(chatId, []);
    messageCache.get(chatId).push(msg); renderMessages(); scrollToBottom(); renderChatList();
  });
  messageInput.value = ''; emojiPanel.style.display = 'none'; updateSendBtn();
  document.getElementById('quoteBar')?.remove(); replyToMsg = null;
};

document.getElementById('fwModalOverlay').onclick=document.getElementById('fwModalClose').onclick=()=>hideBsModal(document.getElementById('forwardModal'));
document.getElementById('fwSearch').addEventListener('input',()=>{
  const q=document.getElementById('fwSearch').value.trim().toLowerCase();
  renderForwardList(myFriends.filter(f=>f.name.toLowerCase().includes(q)));
});
function renderForwardList(list) {
  const el=document.getElementById('fwContactList');
  if(!list.length){el.innerHTML='<p style="text-align:center;padding:.5rem;color:#888;font-size:.78rem">无好友</p>';return;}
  el.innerHTML=list.map(f=>{
    const aHtml=f.avatar?`<img src="${f.avatar}">`:(f.avatarChar||'?');const aBg=f.avatar?'':(f.avatarColor||'#666');
    return `<div class="search-result-item" onclick="doForward('${f.id}')"><div class="avatar" style="width:34px;height:34px;background:${aBg};font-size:.7rem">${aHtml}</div><span style="font-size:.82rem">${escapeHtml(f.name)}</span></div>`;
  }).join('');
}
function doForward(toId) {
  if(!ctxMsgId)return;
  socket.emit('forward-message',{messageId:ctxMsgId,toUserId:toId},(r)=>{if(r.success){showToast('已转发');hideBsModal(document.getElementById('forwardModal'));}else showToast(r.error||'失败');});
}
window.doForward=doForward;

function loadFavorites() {
  socket.emit('get-favorites',(list)=>{
    const el=document.getElementById('favoritesList');
    if(!list||!list.length){el.innerHTML='<p style="text-align:center;padding:1rem;color:#888;font-size:.78rem">暂无收藏</p>';return;}
    el.innerHTML=list.map(f=>`<div style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0;border-bottom:1px solid rgba(255,255,255,.04)"><span style="flex:1;font-size:.8rem;color:#ddd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(f.text||'')}</span><span style="font-size:.65rem;color:#888">${formatTime(f.time)}</span><span style="font-size:.7rem;cursor:pointer;opacity:.5" onclick="deleteFav(\'${f.id}\')">✕</span></div>`).join('');
  });
}
function deleteFav(id){socket.emit('delete-favorite',{id},()=>loadFavorites());}
window.deleteFav=deleteFav;
document.getElementById('favBackBtn').onclick=()=>{document.getElementById('favoritesPage').classList.remove('active');document.querySelector('[data-tab="profile"]')?.click();};

// ─── 修改密码 ─────────────────────────────────────────────
document.getElementById('cpModalOverlay').onclick=document.getElementById('cpModalClose').onclick=()=>hideBsModal(document.getElementById('changePwdModal'));
document.getElementById('cpSaveBtn').addEventListener('click',()=>{
  const o=document.getElementById('cpOldPwd').value,n=document.getElementById('cpNewPwd').value,c=document.getElementById('cpConfirmPwd').value,err=document.getElementById('cpError');
  if(!o){err.textContent='请输入原密码';return;}
  if(!n||n.length<6||n.length>12){err.textContent='新密码需6-12位';return;}
  if(n!==c){err.textContent='两次密码不一致';return;}err.textContent='';
  socket.emit('change-password',{oldPassword:o,newPassword:n},(r)=>{if(r.success){showToast('密码已修改');hideBsModal(document.getElementById('changePwdModal'));document.getElementById('cpOldPwd').value='';document.getElementById('cpNewPwd').value='';document.getElementById('cpConfirmPwd').value='';}else err.textContent=r.error||'修改失败';});
});

// ═══════════════════════════════════════════════════════════════
// 打字状态 / @提醒
// ═══════════════════════════════════════════════════════════════
let atMenuDiv = null;
messageInput.addEventListener('input', () => {
  if (!activeChat) return;
  socket.emit('typing', { to: activeChat });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => { socket.emit('stop-typing', { to: activeChat }); }, 1500);

  if (activeChat.startsWith('g_')) {
    const val = messageInput.value; const ai = val.lastIndexOf('@');
    if (ai >= 0 && (ai === 0 || val[ai-1] === ' ')) {
      const q = val.slice(ai+1).toLowerCase();
      if (!q.includes(' ') && !atMenuDiv) {
        socket.emit('get-group-info', activeChat, (res) => {
          if (!res.success) return;
          atMenuDiv = document.createElement('div'); atMenuDiv.id = 'atMenu';
          atMenuDiv.style.cssText = 'position:absolute;bottom:100%;left:0;background:#2e2e2e;border-radius:8px;padding:.3rem;max-height:150px;overflow-y:auto;z-index:50;min-width:120px;box-shadow:0 4px 20px rgba(0,0,0,.3)';
          atMenuDiv.innerHTML = (res.group.memberDetails||[]).filter(m=>(m.user?.name||'').toLowerCase().includes(q)).map(m=>`<div class="at-item" style="padding:.25rem .5rem;font-size:.8rem;color:#ddd;cursor:pointer;border-radius:4px" onclick="selectAt('${escapeHtml(m.user?.name||m.userId)}')">@${escapeHtml(m.user?.name||m.userId)}</div>`).join('');
          document.querySelector('.input-area')?.appendChild(atMenuDiv);
        });
      } else if (q.includes(' ')) { atMenuDiv?.remove(); atMenuDiv = null; }
    } else { atMenuDiv?.remove(); atMenuDiv = null; }
  }
});
function selectAt(n) {
  const val = messageInput.value; const idx = val.lastIndexOf('@');
  messageInput.value = val.slice(0, idx) + `@${n} `; atMenuDiv?.remove(); atMenuDiv = null; messageInput.focus();
}
window.selectAt = selectAt;

// ═══════════════════════════════════════════════════════════════
// 手机返回
// ═══════════════════════════════════════════════════════════════
mobileBack.addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('with-chat');
  document.querySelector('.chat-area').classList.remove('with-chat');
});

// ═══════════════════════════════════════════════════════════════
// 聊天操作
// ═══════════════════════════════════════════════════════════════
let _chatSettingsCache = null;
function getLocalChatSettings(chatId) {
  return _chatSettingsCache?.get(chatId) || {};
}
function togglePin(userId) {
  const chatId = userId.startsWith('g_') ? userId : getChatId(currentUser.id, userId);
  socket.emit('toggle-chat-pin', { chatId }, (res) => { if (res.success) { showToast(res.pinned ? '已置顶' : '已取消置顶'); renderChatList(); } });
}
window.togglePin = togglePin;
function toggleMute(userId) {
  const chatId = userId.startsWith('g_') ? userId : getChatId(currentUser.id, userId);
  socket.emit('toggle-chat-mute', { chatId }, (res) => { if (res.success) { showToast(res.muted ? '已开启免打扰' : '已关闭免打扰'); renderChatList(); } });
}
window.toggleMute = toggleMute;
function deleteChat(userId) {
  if (!confirm('确定删除此聊天？')) return;
  const chatId = userId.startsWith('g_') ? userId : getChatId(currentUser.id, userId);
  socket.emit('delete-chat', { chatId }, (res) => {
    if (res.success) { messageCache.delete(chatId); if (activeChat === userId) { activeChat = null; chatWindow.style.display = 'none'; emptyState.style.display = 'flex'; } renderChatList(); showToast('已删除'); }
  });
}
window.deleteChat = deleteChat;

// ═══════════════════════════════════════════════════════════════
// 签到
// ═══════════════════════════════════════════════════════════════
function doCheckIn() {
  socket.emit('check-in', (res) => {
    if (res.success) { showToast(`签到成功 +${res.points}积分（连续${res.streak}天）`); currentUser.points = res.total; updateProfileUI(); }
    else showToast(res.error || '签到失败');
  });
}
window.doCheckIn = doCheckIn;

document.getElementById('ppFavRow')?.addEventListener('click', () => {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('favoritesPage').classList.add('active'); loadFavorites();
});
document.getElementById('ppPwdRow')?.addEventListener('click', () => {
  showBsModal(document.getElementById('changePwdModal'));
  document.getElementById('cpOldPwd').value=''; document.getElementById('cpNewPwd').value=''; document.getElementById('cpConfirmPwd').value=''; document.getElementById('cpError').textContent='';
});

// ═══════════════════════════════════════════════════════════════
// 个人资料 UI
// ═══════════════════════════════════════════════════════════════
function updateProfileUI() {
  if (!currentUser) return;
  const u = currentUser;

  // ── 侧栏头像 ──
  const sidebarBadge = profileAvatar.querySelector('.profile-avatar-badge');
  let sidebarImg = profileAvatar.querySelector('img');

  if (u.avatar) {
    profileAvatarChar.style.display = 'none';
    if (!sidebarImg) {
      sidebarImg = document.createElement('img');
      sidebarImg.alt = '';
      profileAvatar.insertBefore(sidebarImg, sidebarBadge);
    }
    sidebarImg.src = u.avatar;
    profileAvatar.style.background = 'transparent';
  } else {
    profileAvatarChar.style.display = '';
    if (sidebarImg) sidebarImg.remove();
    profileAvatarChar.textContent = u.avatarChar || 'U';
    profileAvatar.style.background = u.avatarColor || '#1aad19';
  }

  profileName.textContent = u.name;

  // ── 个人资料面板 ──
  let ppImg = ppAvatar.querySelector('img');
  const ppOverlayHtml = '<div class="pp-avatar-overlay"><i class="bi bi-camera" style="color:#fff;font-size:1.4rem"></i></div>';

  if (u.avatar) {
    ppAvatarChar.style.display = 'none';
    // 移除旧的 overlay（如果有）
    ppAvatar.querySelector('.pp-avatar-overlay')?.remove();
    if (!ppImg) {
      ppImg = document.createElement('img');
      ppImg.alt = '';
      ppAvatar.appendChild(ppImg);
    }
    ppImg.src = u.avatar;
    // 重新添加 overlay
    ppAvatar.insertAdjacentHTML('beforeend', ppOverlayHtml);
    ppAvatar.style.background = 'transparent';
  } else {
    ppAvatarChar.style.display = '';
    ppAvatar.querySelector('.pp-avatar-overlay')?.remove();
    if (ppImg) ppImg.remove();
    ppAvatarChar.textContent = u.avatarChar || 'U';
    ppAvatar.style.background = u.avatarColor || '#1aad19';
  }

  ppName.textContent = u.name;
  ppPhone.textContent = u.phone ? u.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '未绑定';

  if (u.realNameVerified) {
    ppRealNameStatus.innerHTML = `<span class="realname-badge verified">已认证 · ${escapeHtml(u.realName || '')}</span>`;
  } else if (u.verificationStatus === 'pending') {
    ppRealNameStatus.innerHTML = `<span class="realname-badge pending">⏳ 审核中</span>`;
  } else {
    ppRealNameStatus.innerHTML = `<span class="realname-badge unverified">未认证</span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#999" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
  }

  ppBalance.textContent = `¥${(u.balance || 0).toFixed(2)}`;
  document.getElementById('ppGender').textContent = u.gender === 'male' ? '男' : u.gender === 'female' ? '女' : '未设置';
  document.getElementById('ppPoints').textContent = `${u.points || 0} 分`;
}

// ═══════════════════════════════════════════════════════════════
// 头像上传
// ═══════════════════════════════════════════════════════════════
ppChangeAvatar.addEventListener('click', () => avatarInput.click());
ppAvatar.addEventListener('click', () => avatarInput.click());

avatarInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('图片不能超过 2MB'); return; }

  const reader = new FileReader();
  reader.onload = (ev) => {
    const dataUrl = ev.target.result;
    socket.emit('update-avatar', { userId: currentUser.id, dataUrl }, (res) => {
      if (res.success) {
        currentUser.avatar = res.avatar;
        updateProfileUI();
        renderContactList();
        renderChatList();
        if (activeChat) updateChatHeader(activeChat);
        showToast('头像已更新');
      } else {
        showToast(res.error || '上传失败');
      }
    });
  };
  reader.readAsDataURL(file);
});

// ═══════════════════════════════════════════════════════════════
// 编辑昵称
// ═══════════════════════════════════════════════════════════════
ppEditName.addEventListener('click', () => {
  nameEditInput.value = currentUser.name;
  showBsModal(nameEditModal);
  nameEditInput.focus();
});
nameModalOverlay.onclick = nameModalClose.onclick = () => {
  hideBsModal(nameEditModal);
};
nameSaveBtn.addEventListener('click', () => {
  const name = nameEditInput.value.trim();
  if (!name) { showToast('昵称不能为空'); return; }
  socket.emit('update-name', { userId: currentUser.id, name }, (res) => {
    if (res.success) {
      currentUser = res.user;
      updateProfileUI();
      renderContactList();
      renderChatList();
      if (activeChat) updateChatHeader(activeChat);
      hideBsModal(nameEditModal);
      showToast('昵称已更新');
    } else {
      showToast(res.error || '修改失败');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 实名认证
// ═══════════════════════════════════════════════════════════════
ppRealNameRow.addEventListener('click', () => {
  if (currentUser.realNameVerified) {
    showToast('已完成实名认证');
    return;
  }
  showBsModal(realnameModal);
});
realnameOverlay.onclick = realnameClose.onclick = () => {
  hideBsModal(realnameModal);
};
realnameSubmitBtn.addEventListener('click', () => {
  const realName = realnameInput.value.trim();
  const idCard = idcardInput.value.trim();
  if (!realName || realName.length < 2) { showToast('请输入真实姓名'); return; }
  if (!/^\d{17}[\dXx]$/.test(idCard)) { showToast('身份证号格式不正确'); return; }

  socket.emit('verify-realname', { userId: currentUser.id, realName, idCard }, (res) => {
    if (res.success) {
      currentUser = res.user;
      updateProfileUI();
      renderContactList();
      renderChatList();
      hideBsModal(realnameModal);
      showToast('已提交认证，等待管理员审核');
    } else {
      showToast(res.error || '认证失败');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 红包
// ═══════════════════════════════════════════════════════════════
// 打开红包发送弹窗
redpacketBtn.addEventListener('click', () => {
  if (!activeChat) { showToast('请先选择一个聊天'); return; }
  const user = contacts.get(activeChat);
  if (!user) return;
  rpTo.textContent = `发给：${escapeHtml(user.name)}`;
  rpAmount.value = '';
  rpBlessing.value = '';
  document.querySelectorAll('.rp-fast').forEach(b => b.classList.remove('selected'));
  redpacketModal.style.display = 'flex';
  rpAmount.focus();
});

rpModalOverlay.onclick = rpClose.onclick = () => {
  redpacketModal.style.display = 'none';
};

// 快捷金额
rpFastBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    rpFastBtns.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    rpAmount.value = btn.dataset.amt;
  });
});

// 发送红包
rpSendBtn.addEventListener('click', () => {
  if (!currentUser.realNameVerified) {
    redpacketModal.style.display = 'none';
    if (currentUser.verificationStatus === 'pending') {
      showToast('实名认证正在审核中，请等待管理员通过');
    } else {
      showToast('使用红包功能需先实名认证');
    }
    showBsModal(realnameModal);
    return;
  }

  const amount = parseFloat(rpAmount.value);
  const blessing = rpBlessing.value.trim() || '恭喜发财，大吉大利';
  if (isNaN(amount) || amount <= 0) { showToast('请输入有效金额'); rpAmount.focus(); return; }
  if (amount > 200) { showToast('单个红包金额上限 200 元'); return; }
  if (amount < 0.01) { showToast('金额不能低于 0.01 元'); return; }

  rpSendBtn.disabled = true;
  rpSendBtn.textContent = '发送中...';

  socket.emit('send-redpacket', { to: activeChat, amount, blessing }, (res) => {
    rpSendBtn.disabled = false;
    rpSendBtn.textContent = '塞进红包';
    if (res.success) {
      redpacketModal.style.display = 'none';
      const chatId = getChatId(currentUser.id, activeChat);
      if (!messageCache.has(chatId)) messageCache.set(chatId, []);
      messageCache.get(chatId).push(res.message);
      renderMessages();
      scrollToBottom();
      renderChatList();
      showToast('红包已发送');
    } else {
      showToast(res.error || '发送失败');
    }
  });
});

// 打开红包
function handleRedpacketClick(msg) {
  const isMine = msg.from === currentUser.id;
  if (isMine) {
    showToast(msg.redpacket.opened ? '红包已被领取' : '等待对方领取');
    return;
  }
  if (msg.redpacket.opened) {
    showToast('红包已被领取');
    return;
  }

  currentRpMessage = msg;
  rpOpenUnopened.style.display = 'flex';
  rpOpenResult.style.display = 'none';
  const sender = contacts.get(msg.from);
  rpOpenSender.textContent = sender?.name || '用户';
  rpOpenBlessing.textContent = msg.text || '恭喜发财，大吉大利';
  openRpOverlay.style.display = 'flex';
}

rpOpenBtn.addEventListener('click', () => {
  if (!currentRpMessage) return;
  const msg = currentRpMessage;
  socket.emit('open-redpacket', {
    messageId: msg.id,
    packetId: msg.redpacket.packetId,
    chatPartnerId: msg.from,
  }, (res) => {
    if (res.success) {
      // 更新本地状态
      msg.redpacket.opened = true;
      msg.redpacket.openedAt = Date.now();
      currentUser.balance = res.balance;

      // 显示结果
      rpOpenUnopened.style.display = 'none';
      rpOpenResult.style.display = 'flex';
      rpResultAmount.textContent = `¥${res.amount.toFixed(2)}`;
      rpResultFrom.textContent = `来自 ${escapeHtml(res.senderName)} 的红包`;

      renderMessages();
      renderChatList();
      updateProfileUI();
    } else {
      showToast(res.error || '领取失败');
      openRpOverlay.style.display = 'none';
    }
  });
});

rpResultClose.addEventListener('click', () => {
  openRpOverlay.style.display = 'none';
  currentRpMessage = null;
});
rpOpenClose.addEventListener('click', () => {
  if (rpOpenResult.style.display === 'flex') {
    // 已开红包直接关闭
  }
  openRpOverlay.style.display = 'none';
  currentRpMessage = null;
});

// ═══════════════════════════════════════════════════════════════
// 撤回消息
// ═══════════════════════════════════════════════════════════════
function recallMessage(messageId) {
  if (!confirm('撤回这条消息？')) return;
  socket.emit('recall-message', { messageId, to: activeChat }, (res) => {
    if (res.success) {
      // 更新本地缓存
      const chatId = getChatId(currentUser.id, activeChat);
      const msgs = messageCache.get(chatId) || [];
      const msg = msgs.find(m => m.id === messageId);
      if (msg) {
        msg.type = 'recalled';
        msg.text = '';
      }
      renderMessages();
      renderChatList();
    } else {
      showToast(res.error || '撤回失败');
    }
  });
}
window.recallMessage = recallMessage;

// ═══════════════════════════════════════════════════════════════
// 侧栏头像点击（切换到"我的"）
// ═══════════════════════════════════════════════════════════════
sidebarProfile.addEventListener('click', () => {
  tabs.forEach(t => t.classList.remove('active'));
  tabs[2]?.classList.add('active');
  chatList.classList.remove('active');
  contactList.classList.remove('active');
  profilePanel.classList.add('active');
  updateProfileUI();
});

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════
function getChatId(a, b) { return [a, b].sort().join(':'); }

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (d.toDateString() === now.toDateString()) return hhmm;
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `昨天 ${hhmm}`;
  return `${pad(d.getMonth()+1)}/${pad(d.getDate())} ${hhmm}`;
}

function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  if (d.toDateString() === now.toDateString()) return '今天';
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return '昨天';
  return `${d.getFullYear()}年${pad(d.getMonth()+1)}月${pad(d.getDate())}日`;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💚</text></svg>' });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

// ─── 请求通知权限 ──────────────────────────────────────────
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// ─── 窗口自适应 ──────────────────────────────────────────
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    document.getElementById('sidebar').classList.remove('with-chat');
    document.querySelector('.chat-area').classList.remove('with-chat');
  }
});

// ─── 初始化发送按钮状态 ──────────────────────────────────
updateSendBtn();

// ─── Bootstrap: Tooltip + Modal 辅助 ─────────────────────
document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => new bootstrap.Tooltip(el));
function showBsModal(el) { bootstrap.Modal.getOrCreateInstance(el).show(); }
function hideBsModal(el) { const m = bootstrap.Modal.getInstance(el); if (m) m.hide(); }

console.log('💚 WeTalk v2.0 已加载');
