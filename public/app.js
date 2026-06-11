// ─── Socket 连接 ───────────────────────────────────────
const socket = io();

let currentUser = null;         // { id, name, avatar }
let contacts = new Map();       // id -> { id, name, avatar, online }
let activeChat = null;          // 当前聊天对象的 id
let messageCache = new Map();   // chatId -> messages[]
let typingTimeout = null;

// ─── DOM 引用 ───────────────────────────────────────────
const $ = id => document.getElementById(id);
const loginPage = $('loginPage');
const mainPage = $('mainPage');
const loginName = $('loginName');
const loginBtn = $('loginBtn');
const chatList = $('chatList');
const contactList = $('contactList');
const chatWindow = $('chatWindow');
const emptyState = $('emptyState');
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
const searchChat = $('searchChat');
const searchUserInput = $('searchUserInput');
const searchResults = $('searchResults');
const addContactModal = $('addContactModal');
const modalOverlay = $('modalOverlay');
const modalClose = $('modalClose');
const addContactBtn = $('addContactBtn');
const logoutBtn = $('logoutBtn');
const mobileBack = $('mobileBack');
const resultCount = $('resultCount');
const tabs = document.querySelectorAll('.tab');

// ─── Emoji 列表 ────────────────────────────────────────
const EMOJIS = [
  '😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎',
  '😍','😘','🥰','😗','😙','😚','🙂','🤗','🤩','🤔','🤨','😐',
  '😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','😴',
  '😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲',
  '☺️','😖','😞','😟','😤','😢','😭','😦','😧','😨','😩','🤯',
  '😬','😰','😱','🥵','🥶','😳','🤪','😵','😡','😠','🤬','👍',
  '👎','👊','✊','🤛','🤜','👏','🙌','🤲','🤝','✌️','🤟','🤞',
  '❤️','🧡','💛','💚','💙','💜','🖤','💔','💕','💞','💗','💖',
  '🔥','⭐','✨','💪','🦊','🐶','🐱','🐼','🐸','🐤','🦄','🌸',
];

// ─── 初始化 Emoji ──────────────────────────────────────
EMOJIS.forEach(e => {
  const span = document.createElement('span');
  span.textContent = e;
  span.onclick = () => {
    messageInput.value += e;
    messageInput.focus();
    emojiPanel.style.display = 'none';
  };
  emojiGrid.appendChild(span);
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

// ─── 登录 ───────────────────────────────────────────────
loginName.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
loginBtn.addEventListener('click', doLogin);

function doLogin() {
  const name = loginName.value.trim();
  if (!name) { loginName.focus(); return; }

  loginBtn.disabled = true;
  loginBtn.textContent = '登录中...';

  socket.emit('user-login', name, (res) => {
    loginBtn.disabled = false;
    loginBtn.textContent = '登 录';

    if (!res.success) {
      alert(res.error || '登录失败');
      return;
    }

    currentUser = res.user;
    loginPage.classList.remove('active');
    mainPage.classList.add('active');

    // 加载联系人
    res.users.forEach(u => contacts.set(u.id, u));
    renderContactList();

    // 加载聊天列表
    res.chats?.forEach(c => {
      if (c.with) contacts.set(c.with.id, c.with);
    });
    renderChatList();

    // 自动打开第一个聊天
    if (res.chats?.length > 0) {
      openChat(res.chats[0].with.id);
      // 加载历史消息
      socket.emit('get-messages', { with: res.chats[0].with.id }, (msgs) => {
        const chatId = getChatId(currentUser.id, res.chats[0].with.id);
        messageCache.set(chatId, msgs || []);
        renderMessages();
      });
    }
  });
}

// ─── Socket 事件监听 ────────────────────────────────────
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

socket.on('new-message', (msg) => {
  const chatId = getChatId(msg.from, msg.to);
  if (!messageCache.has(chatId)) messageCache.set(chatId, []);
  messageCache.get(chatId).push(msg);

  // 如果正在和发送者聊天，直接显示消息
  const otherId = msg.from === currentUser.id ? msg.to : msg.from;
  if (activeChat === otherId) {
    renderMessages();
    scrollToBottom();
  }

  // 更新聊天列表
  renderChatList();

  // 如果不在聊天界面，浏览器通知
  if (activeChat !== otherId) {
    const sender = contacts.get(msg.from);
    if (sender && document.hidden) {
      showNotification(sender.name, msg.text);
    }
  }
});

socket.on('user-typing', ({ from, name }) => {
  if (activeChat === from) {
    typingIndicator.innerHTML = `${name} <span class="typing-dots"><span></span><span></span><span></span></span>`;
  }
});

socket.on('user-stop-typing', ({ from }) => {
  if (activeChat === from) {
    typingIndicator.textContent = '';
  }
});

// ─── 搜索用户 ───────────────────────────────────────────
let searchTimeout = null;
searchUserInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const q = searchUserInput.value.trim();
    if (!q) { searchResults.innerHTML = ''; return; }
    socket.emit('search-users', q, (users) => {
      searchResults.innerHTML = users.map(u => `
        <div class="search-result-item">
          <div class="avatar" style="background:${u.avatar.color}">${u.avatar.name}</div>
          <div class="info">
            <div class="name">${u.name}</div>
            <div class="status">${u.online ? '在线' : '离线'}</div>
          </div>
          <button class="add-btn" onclick="startChat('${u.id}')">聊天</button>
        </div>
      `).join('') || '<p style="color:#999;font-size:.85rem;text-align:center;padding:1rem">未找到用户</p>';
    });
  }, 300);
});

// ─── 添加联系人按钮 ────────────────────────────────────
addContactBtn.onclick = () => {
  addContactModal.style.display = 'flex';
  searchUserInput.value = '';
  searchResults.innerHTML = '';
  searchUserInput.focus();
};
modalOverlay.onclick = modalClose.onclick = () => {
  addContactModal.style.display = 'none';
};

// ─── 退出登录 ───────────────────────────────────────────
logoutBtn.onclick = () => {
  if (confirm('退出登录？')) {
    socket.disconnect();
    location.reload();
  }
};

// ─── 聊天列表渲染 ──────────────────────────────────────
function renderChatList() {
  const chatItems = [];
  for (const [id, user] of contacts) {
    if (id === currentUser.id) continue;
    const chatId = getChatId(currentUser.id, id);
    const msgs = messageCache.get(chatId) || [];
    const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
    const unread = msgs.filter(m => m.from === id && !m.read).length;

    chatItems.push({
      user,
      lastMsg,
      unread,
      time: lastMsg?.time || 0,
    });
  }

  chatItems.sort((a, b) => b.time - a.time);

  chatList.innerHTML = chatItems.map(c => {
    const displayName = c.user.name;
    const avatar = c.user.avatar;
    const lastText = c.lastMsg ? c.lastMsg.text.slice(0, 25) + (c.lastMsg.text.length > 25 ? '...' : '') : '暂无消息';
    const timeStr = c.lastMsg ? formatTime(c.lastMsg.time) : '';
    const isActive = activeChat === c.user.id;

    return `
      <div class="chat-item ${isActive ? 'active' : ''}" onclick="openChat('${c.user.id}')">
        <div class="avatar" style="background:${avatar.color}">
          ${avatar.name}
          <span class="online-dot ${c.user.online ? '' : 'offline'}"></span>
        </div>
        <div class="chat-item-info">
          <div class="chat-item-name">${displayName}</div>
          <div class="chat-item-preview">${lastText}</div>
        </div>
        <div class="chat-item-right">
          <div class="chat-item-time">${timeStr}</div>
          ${c.unread > 0 ? `<div class="unread-badge">${c.unread}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ─── 联系人列表渲染 ────────────────────────────────────
function renderContactList() {
  const items = Array.from(contacts.values())
    .filter(u => u.id !== currentUser.id)
    .sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0));

  contactList.innerHTML = items.map(u => {
    const chatId = getChatId(currentUser.id, u.id);
    const msgs = messageCache.get(chatId) || [];
    const unread = msgs.filter(m => m.from === u.id && !m.read).length;

    return `
      <div class="contact-item" onclick="openChat('${u.id}')">
        <div class="avatar" style="background:${u.avatar.color}">
          ${u.avatar.name}
          <span class="online-dot ${u.online ? '' : 'offline'}"></span>
        </div>
        <div style="flex:1;min-width:0">
          <div class="contact-name">${u.name}</div>
          <div class="contact-status">${u.online ? '在线' : '离线'}</div>
        </div>
        ${unread > 0 ? `<div class="unread-badge">${unread}</div>` : ''}
      </div>
    `;
  }).join('');

  if (items.length === 0) {
    contactList.innerHTML = `
      <div style="text-align:center;padding:2rem;color:#666;font-size:.85rem">
        <p style="font-size:2rem;margin-bottom:.5rem">📭</p>
        <p>暂无联系人</p>
        <p style="margin-top:.3rem;font-size:.78rem;color:#888">点击右上角 ➕ 添加好友</p>
      </div>
    `;
  }
}

// ─── 打开聊天 ──────────────────────────────────────────
function openChat(userId) {
  activeChat = userId;
  const user = contacts.get(userId);
  if (!user) return;

  // 清除未读
  clearUnread(userId);

  // 更新 UI
  emptyState.style.display = 'none';
  chatWindow.style.display = 'flex';
  updateChatHeader(userId);
  renderChatList();
  renderContactList();

  // 移动端适配
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.add('with-chat');
    document.querySelector('.chat-area').classList.add('with-chat');
  }

  // 加载消息
  const chatId = getChatId(currentUser.id, userId);
  if (!messageCache.has(chatId) || messageCache.get(chatId).length === 0) {
    socket.emit('get-messages', { with: userId }, (msgs) => {
      messageCache.set(chatId, msgs || []);
      renderMessages();
      scrollToBottom();
    });
  } else {
    renderMessages();
    scrollToBottom();
  }
}

// 暴露到全局供 onclick 调用
window.openChat = openChat;

function startChat(userId) {
  addContactModal.style.display = 'none';
  if (!contacts.has(userId)) {
    // 如果是新联系人，创建一个临时条目
    contacts.set(userId, { id: userId, name: userId, avatar: { name: userId.charAt(0).toUpperCase(), color: '#666' }, online: false });
  }
  openChat(userId);
}
window.startChat = startChat;

function clearUnread(userId) {
  const chatId = getChatId(currentUser.id, userId);
  const msgs = messageCache.get(chatId);
  if (msgs) msgs.forEach(m => { if (m.from === userId) m.read = true; });
}

function updateChatHeader(userId) {
  const user = contacts.get(userId);
  if (!user) return;
  chatAvatar.textContent = user.avatar.name;
  chatAvatar.style.background = user.avatar.color;
  chatName.textContent = user.name;
  chatStatus.textContent = user.online ? '在线' : '离线';
  chatStatus.style.color = user.online ? '#1aad19' : '#888';
}

// ─── 消息渲染 ──────────────────────────────────────────
function renderMessages() {
  if (!activeChat) return;
  const chatId = getChatId(currentUser.id, activeChat);
  const msgs = messageCache.get(chatId) || [];
  const user = contacts.get(activeChat);

  messagesContainer.innerHTML = msgs.map(m => {
    const isMine = m.from === currentUser.id;
    const sender = isMine ? currentUser : user;
    const avatarChar = sender?.avatar?.name || '?';
    const avatarColor = sender?.avatar?.color || '#999';
    const timeStr = formatTime(m.time);

    return `
      <div class="message-row ${isMine ? 'mine' : 'other'}">
        <div class="message-avatar" style="background:${avatarColor}">${avatarChar}</div>
        <div>
          <div class="message-bubble">${escapeHtml(m.text)}</div>
          <div class="message-time">${timeStr}</div>
        </div>
      </div>
    `;
  }).join('');
}

function scrollToBottom() {
  setTimeout(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, 20);
}

// ─── 发送消息 ──────────────────────────────────────────
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
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ─── 打字状态 ──────────────────────────────────────────
messageInput.addEventListener('input', () => {
  if (!activeChat) return;
  socket.emit('typing', { to: activeChat });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('stop-typing', { to: activeChat });
  }, 1500);
});

// ─── 手机返回按钮 ──────────────────────────────────────
mobileBack.addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('with-chat');
  document.querySelector('.chat-area').classList.remove('with-chat');
});

// ─── Tab 切换 ───────────────────────────────────────────
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    document.getElementById('chatList').classList.toggle('active', target === 'chats');
    document.getElementById('contactList').classList.toggle('active', target === 'contacts');
  });
});

// ─── 搜索聊天 ──────────────────────────────────────────
searchChat.addEventListener('input', () => {
  const q = searchChat.value.trim().toLowerCase();
  document.querySelectorAll('.chat-item').forEach(el => {
    const name = el.querySelector('.chat-item-name')?.textContent?.toLowerCase() || '';
    el.style.display = name.includes(q) ? 'flex' : 'none';
  });
  document.querySelectorAll('.contact-item').forEach(el => {
    const name = el.querySelector('.contact-name')?.textContent?.toLowerCase() || '';
    el.style.display = name.includes(q) ? 'flex' : 'none';
  });
});

// ─── 工具函数 ───────────────────────────────────────────
function getChatId(a, b) { return [a, b].sort().join(':'); }

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  if (d.toDateString() === now.toDateString()) return hhmm;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${hhmm}`;

  return `${pad(d.getMonth()+1)}/${pad(d.getDate())} ${hhmm}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💬</text></svg>' });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

// ─── 请求通知权限 ──────────────────────────────────────
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// ─── 窗口自适应 ──────────────────────────────────────
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    document.getElementById('sidebar').classList.remove('with-chat');
    document.querySelector('.chat-area').classList.remove('with-chat');
  }
});

console.log('💬 Chat App 已加载');
