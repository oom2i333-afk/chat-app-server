// ═══════════════════════════════════════════════════════════════
// WeTalk - v3.0 (REST + SSE) - all socket.io replaced by Api + SSE
// 手机验证 红包 已读 撤回 个人资料
// ═══════════════════════════════════════════════════════════════

window.onerror = function(msg, url, line, col, err) {
  console.warn('[Global] 捕获错误:', msg, '(' + line + ':' + col + ')');
  return true;
};
window.addEventListener('unhandledrejection', function(e) {
  console.warn('[Global] 未处理的 Promise 拒绝:', e.reason && e.reason.message || e.reason);
  e.preventDefault();
});

// ─── SSE Client ──────────────────────────────────────────
let sseClient = null;

// ─── 状态变量 ────────────────────────────────────────────
let currentUser = null;
let contacts = new Map();
let activeChat = null;
let messageCache = new Map();
let typingTimeout = null;
let codeTimer = null;
let codeCountdown = 0;
let currentRpMessage = null;
let myGroups = [];
let myFriends = [];
let pendingReqs = [];
let currentRegCaptchaId = '';
let selectedGender = '';
let setupAvatarDataUrl = '';
let msgSearchResults = [];
let msgSearchIndex = -1;
let ctxMsgId = null;
let ctxMsgChatId = null;
let replyToMsg = null;
let selectedMsgIds = new Set();
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = 0;
let recordingTimerInterval = null;
let isRecording = false;
let currentPlayingVoice = null;
let voicePlayInterval = null;
const cgSelected = new Set();
var reactionPanel = null;
var reactionTargetMsgId = null;
let searchTimeout = null;
let voicePressTimer = null;
let isVoicePressed = false;
let voiceCancelY = 0;
let _chatSettingsCache = null;
let atMenuDiv = null;

// ─── DOM ──────────────────────────────────────────────────
var $ = function(id) { return document.getElementById(id); };

var safeOn = function(id, event, handler) {
  var el = $(id);
  if (el) el.addEventListener(event, handler);
  else console.warn('[DOM] 元素 #' + id + ' 不存在');
};

// 登录页
var loginPage = $('loginPage');
var mainPage = $('mainPage');
var loginBtn = $('loginBtn');

// 侧栏
var sidebarProfile = $('sidebarProfile');
var profileAvatar = $('profileAvatar');
var profileAvatarChar = $('profileAvatarChar');
var profileName = $('profileName');
var chatList = $('chatList');
var contactList = $('contactList');
var searchChat = $('searchChat');
var tabs = document.querySelectorAll('.tab');
var addContactBtn2 = $('addContactBtn2');
var logoutBtn = $('logoutBtn');

// 聊天区
var emptyState = $('emptyState');
var chatWindow = $('chatWindow');
var messagesContainer = $('messagesContainer');
var messageInput = $('messageInput');
var sendBtn = $('sendBtn');
var chatName = $('chatName');
var chatStatus = $('chatStatus');
var chatAvatar = $('chatAvatar');
var typingIndicator = $('typingIndicator');
var emojiBtn = $('emojiBtn');
var emojiPanel = $('emojiPanel');
var emojiGrid = $('emojiGrid');
var mobileBack = $('mobileBack');
var redpacketBtn = $('redpacketBtn');

// 弹窗
var addContactModal = $('addContactModal');
var modalOverlay = $('modalOverlay');
var modalClose = $('modalClose');
var searchUserInput = $('searchUserInput');
var searchResults = $('searchResults');

// 个人资料
var profilePanel = $('profilePanel');
var ppAvatar = $('ppAvatar');
var ppAvatarChar = $('ppAvatarChar');
var ppChangeAvatar = $('ppChangeAvatar');
var avatarInput = $('avatarInput');
var ppName = $('ppName');
var ppEditName = $('ppEditName');
var ppPhone = $('ppPhone');
var ppRealNameStatus = $('ppRealNameStatus');
var ppRealNameRow = $('ppRealNameRow');
var ppBalance = $('ppBalance');
var ppLogout = $('ppLogout');

// 编辑昵称
var nameEditModal = $('nameEditModal');
var nameModalOverlay = $('nameModalOverlay');
var nameModalClose = $('nameModalClose');
var nameEditInput = $('nameEditInput');
var nameSaveBtn = $('nameSaveBtn');

// 实名认证
var realnameModal = $('realnameModal');
var realnameOverlay = $('realnameOverlay');
var realnameClose = $('realnameClose');
var realnameInput = $('realnameInput');
var idcardInput = $('idcardInput');
var realnameSubmitBtn = $('realnameSubmitBtn');

// 红包
var redpacketModal = $('redpacketModal');
var rpModalOverlay = $('rpModalOverlay');
var rpClose = $('rpClose');
var rpTo = $('rpTo');
var rpAmount = $('rpAmount');
var rpBlessing = $('rpBlessing');
var rpSendBtn = $('rpSendBtn');
var rpFastBtns = document.querySelectorAll('.rp-fast');
var openRpOverlay = $('openRpOverlay');
var rpOpenUnopened = $('rpOpenUnopened');
var rpOpenResult = $('rpOpenResult');
var rpOpenSender = $('rpOpenSender');
var rpOpenBlessing = $('rpOpenBlessing');
var rpOpenBtn = $('rpOpenBtn');
var rpResultAmount = $('rpResultAmount');
var rpResultFrom = $('rpResultFrom');
var rpResultClose = $('rpResultClose');
var rpOpenClose = $('rpOpenClose');

// 群组
var createGroupBtn = $('createGroupBtn');
var createGroupModal = $('createGroupModal');
var cgModalOverlay = $('cgModalOverlay');
var cgModalClose = $('cgModalClose');
var cgNameInput = $('cgNameInput');
var cgSearchInput = $('cgSearchInput');
var cgContactList = $('cgContactList');
var cgCreateBtn = $('cgCreateBtn');
var groupInfoModal = $('groupInfoModal');
var giModalOverlay = $('giModalOverlay');
var giModalClose = $('giModalClose');
var giAvatar = $('giAvatar');
var giName = $('giName');
var giCount = $('giCount');
var giActions = $('giActions');
var giMembers = $('giMembers');

// Toast
var toastContainer = $('toastContainer');

// Message search
var msgSearchBar = $('msgSearchBar');
var msgSearchInput = $('msgSearchInput');
var msgSearchCount = $('msgSearchCount');
var msgSearchUp = $('msgSearchUp');
var msgSearchDown = $('msgSearchDown');
var msgSearchClose = $('msgSearchClose');
var chatSearchBtn = $('chatSearchBtn');

// Selection
var selectionToolbar = $('selectionToolbar');
var selectionCount = $('selectionCount');
var selectionDelete = $('selectionDelete');
var selectionForward = $('selectionForward');
var selectionCancel = $('selectionCancel');

// Image
var imageBtn = $('imageBtn');
var imageInput = $('imageInput');

// Voice
var voiceBtn = document.getElementById('voiceBtn');
var recordingOverlay = document.getElementById('recordingOverlay');
var recordingTimer = document.getElementById('recordingTimer');
var voicePlayer = document.getElementById('voicePlayer');

// Loading skeleton
var msgLoadingSkeleton = $('msgLoadingSkeleton');

// Call
var chatVoiceCallBtn = document.getElementById('chatVoiceCallBtn');
var chatVideoCallBtn = document.getElementById('chatVideoCallBtn');

// File
var fileBtn = $('fileBtn');
var fileInput = $('fileInput');

// ═══════════════════════════════════════════════════════════════
// NativeBridge
// ═══════════════════════════════════════════════════════════════
const NativeBridge = {
  get isApp() { return typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform(); },
  get platform() { if (!this.isApp) return 'web'; return Capacitor.getPlatform(); },
  async pickImage() {
    if (!this.isApp) return this.pickImageLegacy();
    try {
      const Camera = Capacitor.Plugins.Camera;
      if (typeof Camera.pickImages === 'function') {
        const result = await Camera.pickImages({ quality: 80, limit: 1, correctOrientation: true });
        if (result && result.photos && result.photos.length > 0)
          return result.photos[0].dataUrl || result.photos[0].webPath || result.photos[0].path;
      }
      const photo = await Camera.getPhoto({ quality: 80, resultType: 'DATA_URL', source: 'PHOTOS', correctOrientation: true });
      if (photo && photo.dataUrl) return photo.dataUrl;
      if (photo && photo.base64String) return 'data:image/jpeg;base64,' + photo.base64String;
      return null;
    } catch (e) { console.warn('[NativeBridge] Camera failed', e.message); return this.pickImageLegacy(); }
  },
  pickImageLegacy() {
    return new Promise(function(resolve) {
      var input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) { resolve(null); return; }
        if (file.size > 5 * 1024 * 1024) { showToast('图片不能超过 5MB', 2000, 'error'); resolve(null); return; }
        var reader = new FileReader();
        reader.onload = function(ev) { resolve(ev.target.result); };
        reader.onerror = function() { resolve(null); };
        reader.readAsDataURL(file);
      };
      input.click();
    });
  },
  async requestMicPermission() {
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(function(t) { t.stop(); });
      return true;
    } catch (e) {
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') return false;
      return true;
    }
  },
  keyboardListeners: [],
  onKeyboardShow(callback) {
    if (!this.isApp) return;
    var Keyboard = Capacitor.Plugins.Keyboard;
    var listener = Keyboard.addListener('keyboardWillShow', function(info) { callback(info.keyboardHeight); });
    this.keyboardListeners.push(listener);
  },
  onKeyboardHide(callback) {
    if (!this.isApp) return;
    var Keyboard = Capacitor.Plugins.Keyboard;
    var listener = Keyboard.addListener('keyboardWillHide', function() { callback(); });
    this.keyboardListeners.push(listener);
  },
  removeKeyboardListeners() {
    this.keyboardListeners.forEach(function(l) { l.remove(); });
    this.keyboardListeners = [];
  },
};

if (NativeBridge.isApp) {
  NativeBridge.onKeyboardShow(function(height) {
    if (messagesContainer) { messagesContainer.classList.add('keyboard-open'); messagesContainer.style.paddingBottom = (height + 60) + 'px'; }
    scrollToBottom();
  });
  NativeBridge.onKeyboardHide(function() {
    if (messagesContainer) { messagesContainer.classList.remove('keyboard-open'); messagesContainer.style.paddingBottom = ''; }
  });
  try {
    var PushNotifications = Capacitor.Plugins.PushNotifications;
    PushNotifications.requestPermissions().then(function(result) {
      if (result.receive === 'granted') PushNotifications.register();
    });
    PushNotifications.addListener('registration', function(token) {
      console.log('[Push] Token:', token.value);
      fetch('/api/push/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token.value, platform: NativeBridge.platform }) }).catch(function() {});
    });
    PushNotifications.addListener('pushReceived', function(n) { console.log('[Push] Received:', n); });
    PushNotifications.addListener('pushNotificationActionPerformed', function(n) { console.log('[Push] Action:', n); });
  } catch (e) { console.warn('[Push] 初始化失败:', e.message); }
}

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

function renderEmojis(cat) {
  if (!cat) cat = 'all';
  var list = EMOJI_MAP[cat] || EMOJI_MAP.all;
  emojiGrid.innerHTML = list.map(function(e) { return '<span>' + e + '</span>'; }).join('');
  emojiGrid.querySelectorAll('span').forEach(function(el) {
    el.onclick = function() {
      messageInput.value += el.textContent;
      messageInput.focus();
      emojiPanel.style.display = 'none';
    };
  });
}
renderEmojis();

document.querySelectorAll('.emoji-cat').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.emoji-cat').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    renderEmojis(btn.dataset.cat);
  });
});

if (emojiBtn) {
  emojiBtn.onclick = function(e) {
    e.stopPropagation();
    emojiPanel.style.display = emojiPanel.style.display === 'none' ? 'block' : 'none';
  };
}
document.addEventListener('click', function(e) {
  if (!emojiPanel.contains(e.target) && e.target !== emojiBtn) emojiPanel.style.display = 'none';
});

// ═══════════════════════════════════════════════════════════════
// Toast
// ═══════════════════════════════════════════════════════════════
function showToast(msg, duration, type) {
  if (!duration) duration = 2000;
  if (!type) type = '';
  var el = document.createElement('div');
  el.className = 'wt-toast' + (type ? ' toast-' + type : '');
  var iconMap = { success: '✓', error: '✕', warning: '⚠' };
  var icon = iconMap[type] || '';
  if (icon) {
    var iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.textContent = icon;
    el.appendChild(iconSpan);
  }
  var textSpan = document.createElement('span');
  textSpan.textContent = msg;
  el.appendChild(textSpan);
  toastContainer.appendChild(el);
  setTimeout(function() {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-8px) scale(.95)';
    el.style.transition = 'opacity .2s, transform .2s';
    setTimeout(function() { el.remove(); }, 200);
  }, duration);
}

// ═══════════════════════════════════════════════════════════════
// 登录 / 注册
// ═══════════════════════════════════════════════════════════════
document.querySelectorAll('.login-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.login-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.login-form').forEach(function(f) { f.classList.remove('active'); });
    tab.classList.add('active');
    $(tab.dataset.tab === 'login' ? 'loginForm' : 'registerForm').classList.add('active');
    document.getElementById('loginError').textContent = '';
    document.getElementById('regError').textContent = '';
  });
});

document.querySelectorAll('.pw-toggle').forEach(function(el) {
  el.addEventListener('click', function() {
    var input = el.parentElement.querySelector('input');
    input.type = input.type === 'password' ? 'text' : 'password';
    el.textContent = input.type === 'password' ? '👁' : '👁‍🗨';
  });
});

async function refreshCaptcha(imgEl) {
  try {
    var data = await Api.getCaptcha();
    if (data) { imgEl.textContent = data.code; currentRegCaptchaId = data.captchaId; }
  } catch(e) { /* ignore */ }
}

safeOn('regCaptchaImg', 'click', function() { refreshCaptcha(this); });
setTimeout(function() { refreshCaptcha(document.getElementById('regCaptchaImg')); }, 100);

safeOn('loginPhone', 'keydown', function(e) { if (e.key === 'Enter') document.getElementById('loginPassword').focus(); });
safeOn('loginPassword', 'keydown', function(e) { if (e.key === 'Enter') doLogin(); });
safeOn('regPhone', 'keydown', function(e) { if (e.key === 'Enter') document.getElementById('regPassword').focus(); });
safeOn('regPassword', 'keydown', function(e) { if (e.key === 'Enter') document.getElementById('regConfirm').focus(); });
safeOn('regConfirm', 'keydown', function(e) { if (e.key === 'Enter') document.getElementById('regCaptcha').focus(); });
safeOn('regCaptcha', 'keydown', function(e) { if (e.key === 'Enter') document.getElementById('regInvite').focus(); });
safeOn('regInvite', 'keydown', function(e) { if (e.key === 'Enter') doRegister(); });
safeOn('loginBtn', 'click', doLogin);
safeOn('registerBtn', 'click', doRegister);

function showLoading(text) {
  var overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;
  document.getElementById('loadingText').textContent = text || '加载中...';
  overlay.style.display = 'flex';
}
function hideLoading() {
  var overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

async function doLogin() {
  var phone = document.getElementById('loginPhone').value.trim();
  var password = document.getElementById('loginPassword').value;
  var errEl = document.getElementById('loginError');
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) { errEl.textContent = '请输入有效手机号'; return; }
  if (!password || password.length < 6) { errEl.textContent = '请输入密码（8-64位）'; return; }
  var btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.textContent = '登录中...'; errEl.textContent = '';
  try {
    var data = await Api.login(phone, password);
    TokenManager.setTokens(data.accessToken, data.refreshToken);
    currentUser = data.user;
    if (data.needProfile) { showProfilePage(); btn.disabled = false; btn.textContent = '登 录'; return; }
    showLoading('正在进入...');
    if (window._loadResources) _loadResources();
    enterMain();
    await loadUserData();
    setupSSEClient();
    btn.disabled = false; btn.textContent = '登 录';
    hideLoading();
  } catch (e) {
    errEl.textContent = e.message || '登录失败';
    btn.disabled = false; btn.textContent = '登 录';
    hideLoading();
  }
}

async function doRegister() {
  var phone = document.getElementById('regPhone').value.trim();
  var password = document.getElementById('regPassword').value;
  var confirm = document.getElementById('regConfirm').value;
  var captcha = document.getElementById('regCaptcha').value.trim();
  var inviteCode = document.getElementById('regInvite').value.trim();
  var errEl = document.getElementById('regError');
  var btn = document.getElementById('registerBtn');
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) { errEl.textContent = '请输入有效手机号'; return; }
  if (!password || password.length < 8 || password.length > 64) { errEl.textContent = '密码长度需 8-64 位'; return; }
  if (!/[a-zA-Z]/.test(password)) { errEl.textContent = '密码需包含至少一个字母'; return; }
  if (password !== confirm) { errEl.textContent = '两次密码不一致'; return; }
  if (!captcha) { errEl.textContent = '请输入验证码'; return; }
  if (!inviteCode) { errEl.textContent = '请输入邀请码'; return; }
  btn.disabled = true; btn.textContent = '注册中...'; errEl.textContent = '';
  try {
    var data = await Api.register(phone, password, captcha, currentRegCaptchaId, inviteCode);
    document.getElementById('loginPhone').value = phone;
    document.getElementById('loginPassword').value = password;
    document.querySelector('[data-tab="login"]').click();
    errEl.textContent = '';
    document.getElementById('loginError').textContent = '✅ 注册成功，请登录';
    document.getElementById('loginError').style.color = 'var(--green)';
    btn.disabled = false; btn.textContent = '注 册';
    if (data.needProfile) { currentUser = { id: data.userId, phone: phone }; showProfilePage(); }
  } catch (e) {
    errEl.textContent = e.message || '注册失败';
    btn.disabled = false; btn.textContent = '注 册';
    refreshCaptcha(document.getElementById('regCaptchaImg'));
  }
}

// ─── 完善资料页 ──────────────────────────────────────────
function showProfilePage() {
  loginPage.classList.remove('active');
  document.getElementById('profilePage').classList.add('active');
  selectedGender = '';
  setupAvatarDataUrl = '';
  document.querySelectorAll('.gender-btn').forEach(function(b) { b.classList.remove('selected'); });
  document.getElementById('setupAvatarChar').textContent = '?';
  document.getElementById('setupAvatarChar').style.display = '';
  var img = document.getElementById('setupAvatar').querySelector('img');
  if (img) img.remove();
}

document.querySelectorAll('.gender-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.gender-btn').forEach(function(b) { b.classList.remove('selected'); });
    btn.classList.add('selected');
    selectedGender = btn.dataset.gender;
  });
});

document.getElementById('setupAvatar').addEventListener('click', function() { document.getElementById('setupAvatarInput').click(); });
document.getElementById('setupAvatarInput').addEventListener('change', function(e) {
  var file = e.target.files[0];
  if (!file || file.size > 2*1024*1024) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    setupAvatarDataUrl = ev.target.result;
    var img = document.createElement('img');
    img.src = setupAvatarDataUrl;
    document.getElementById('setupAvatarChar').style.display = 'none';
    var oldImg = document.getElementById('setupAvatar').querySelector('img');
    if (oldImg) oldImg.remove();
    document.getElementById('setupAvatar').insertBefore(img, document.querySelector('.pp-setup-overlay'));
  };
  reader.readAsDataURL(file);
});

document.getElementById('setupCompleteBtn').addEventListener('click', async function() {
  var btn = document.getElementById('setupCompleteBtn');
  var name = document.getElementById('setupName').value.trim() || '用户' + (currentUser && currentUser.phone ? currentUser.phone.slice(-4) : '');
  btn.disabled = true; btn.textContent = '处理中...';
  document.getElementById('setupError').textContent = '';
  try {
    await Api.updateProfile({ nickname: name, gender: selectedGender, avatar: setupAvatarDataUrl });
    await loadUserData();
    document.getElementById('profilePage').classList.remove('active');
    loginPage.classList.remove('active');
    mainPage.classList.add('active');
    updateProfileUI();
    setupSSEClient();
  } catch (e) {
    document.getElementById('setupError').textContent = e.message || '保存失败';
    btn.disabled = false; btn.textContent = '进入 WeTalk';
  }
});

function enterMain() {
  loginPage.classList.remove('active');
  var pp = document.getElementById('profilePage');
  if (pp) pp.classList.remove('active');
  mainPage.classList.add('active');
  updateProfileUI();
}

// ═══════════════════════════════════════════════════════════════
// 应用启动：Token 检查 + 自动登录
// ═══════════════════════════════════════════════════════════════
(async function initApp() {
  TokenManager.init();
  if (TokenManager.isAuthenticated()) {
    try {
      showLoading('正在登录...');
      var profile = await Api.getProfile();
      currentUser = profile;
      enterMain();
      await loadUserData();
      setupSSEClient();
      hideLoading();
    } catch (e) {
      hideLoading();
      console.warn('[Init] 自动登录失败:', e.message);
    }
  }
})();

// ═══════════════════════════════════════════════════════════════
// 加载用户数据 + SSE 连接
// ═══════════════════════════════════════════════════════════════
async function loadUserData() {
  try {
    var profile = await Api.getProfile().catch(function() { return currentUser; });
    if (profile && profile.id) currentUser = profile;
    var friends = await Api.getFriends().catch(function() { return []; });
    myFriends = friends || [];
    friends.forEach(function(u) { contacts.set(u.id, u); });
    var groups = await Api.getGroups().catch(function() { return []; });
    myGroups = groups || [];
    groups.forEach(function(g) {
      contacts.set(g.id, { id: g.id, name: g.name, avatar: null, avatarColor: g.avatarColor, avatarChar: g.avatarChar, online: true });
    });
    var reqs = await Api.getFriendRequests().catch(function() { return []; });
    pendingReqs = reqs || [];
    updateProfileUI();
    renderContactList();
    renderChatList();
    if (myFriends.length > 0) {
      openChat(myFriends[0].id);
      var chatId = getChatId(currentUser.id, myFriends[0].id);
      try {
        var msgs = await Api.getMessages(chatId, 50, 0);
        messageCache.set(chatId, msgs || []);
        renderMessages();
        scrollToBottom();
      } catch(e) { /* ignore */ }
    }
    setTimeout(subscribePushNotifications, 1500);
  } catch (e) {
    console.warn('[LoadData] 加载失败:', e.message);
  }
}

function setupSSEClient() {
  if (sseClient) sseClient.disconnect();
  sseClient = new SSEClient();
  registerSSEHandlers();
  sseClient.connect();
}

// ═══════════════════════════════════════════════════════════════
// SSE 事件处理器
// ═══════════════════════════════════════════════════════════════
function registerSSEHandlers() {
  if (!sseClient) return;

  sseClient.on('new-message', function(msg) {
    var isGroup = msg.to.startsWith('g_');
    var chatId = isGroup ? msg.to : getChatId(msg.from, msg.to);
    if (!messageCache.has(chatId)) messageCache.set(chatId, []);
    messageCache.get(chatId).push(msg);
    var otherId = msg.from === currentUser.id ? msg.to : msg.from;
    if (activeChat === otherId) { renderMessages(); scrollToBottom(); markAsReadViaApi(otherId); }
    renderChatList();
    if (activeChat !== otherId) {
      var sender = contacts.get(msg.from);
      if (sender && document.hidden) {
        var name = msg.type === 'redpacket' ? '[红包]' : sender.name;
        showNotification(name, msg.type === 'redpacket' ? msg.text : msg.text);
      }
    }
  });

  sseClient.on('message-status', function(data) {
    for (var _i in messageCache) {
      var msgs = messageCache[_i];
      if (!msgs) continue;
      var msg = msgs.find(function(m) { return m.id === data.messageId; });
      if (msg) { msg.status = data.status; break; }
    }
    renderMessages();
  });

  sseClient.on('user-online', function(user) {
    contacts.set(user.id, Object.assign({}, user, { online: true }));
    renderContactList(); renderChatList();
    if (activeChat === user.id) updateChatHeader(user.id);
  });

  sseClient.on('user-offline', function(data) {
    var user = contacts.get(data.id);
    if (user) user.online = false;
    renderContactList(); renderChatList();
    if (activeChat === data.id) updateChatHeader(data.id);
  });

  sseClient.on('new-friend-request', function(data) {
    showToast('来自 ' + (data.from && data.from.name || '用户') + ' 的好友请求');
    loadFriends();
  });

  sseClient.on('friend-added', function(data) {
    if (data.user) contacts.set(data.user.id, data.user);
    loadFriends(); renderContactList();
  });

  sseClient.on('group-updated', function(group) {
    if (contacts.has(group.id)) contacts.set(group.id, Object.assign({}, contacts.get(group.id), { name: group.name, avatarColor: group.avatarColor, avatarChar: group.avatarChar }));
    if (activeChat === group.id) {
      var g = myGroups.find(function(gg) { return gg.id === group.id; });
      if (g) Object.assign(g, group);
      updateChatHeader(group.id);
    }
    renderChatList();
  });
}

// ═══════════════════════════════════════════════════════════════
// 搜索用户
// ═══════════════════════════════════════════════════════════════
searchUserInput.addEventListener('input', function() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async function() {
    var q = searchUserInput.value.trim();
    if (!q) { searchResults.innerHTML = ''; return; }
    try {
      var users = await Api.searchUsers(q);
      searchResults.innerHTML = (users || []).map(function(u) {
        var avatarHtml = u.avatar ? '<img src="' + u.avatar + '" alt="">' : (u.avatarChar || '?');
        return '<div class="search-result-item"><div class="avatar" style="background:' + (u.avatarColor || '#666') + '">' + avatarHtml + '</div><div class="info"><div class="name">' + escapeHtml(u.name) + '</div><div class="status">' + (u.online ? '在线' : '离线') + (u.realNameVerified ? ' . 已实名' : '') + '</div></div><button class="add-btn" onclick="startChat(\'' + u.id + '\')">聊天</button></div>';
      }).join('') || '<p style="color:#999;font-size:.82rem;text-align:center;padding:1rem">未找到用户</p>';
    } catch (e) {
      searchResults.innerHTML = '<p style="color:#999;font-size:.82rem;text-align:center;padding:1rem">搜索失败</p>';
    }
  }, 300);
});

// ═══════════════════════════════════════════════════════════════
// 添加联系人
// ═══════════════════════════════════════════════════════════════
addContactBtn2.addEventListener('click', function() {
  showBsModal(addContactModal);
  searchUserInput.value = '';
  searchResults.innerHTML = '';
  searchUserInput.focus();
});
modalOverlay.onclick = modalClose.onclick = function() { hideBsModal(addContactModal); };

// 创建群聊
createGroupBtn.addEventListener('click', function() {
  cgNameInput.value = '';
  cgSearchInput.value = '';
  renderCgContactList(Array.from(contacts.values()).filter(function(c) { return c.id !== currentUser.id; }));
  showBsModal(createGroupModal);
  cgNameInput.focus();
});
cgModalOverlay.onclick = cgModalClose.onclick = function() { hideBsModal(createGroupModal); };

function renderCgContactList(items) {
  cgContactList.innerHTML = items.map(function(c) {
    var sel = cgSelected.has(c.id);
    return '<div class="cg-contact-item ' + (sel ? 'selected' : '') + '" data-id="' + c.id + '"><div class="avatar" style="background:' + (c.avatarColor||'#666') + '">' + (c.avatarChar||'?') + '</div><span class="cg-name">' + escapeHtml(c.name) + '</span><div class="cg-check"></div></div>';
  }).join('');
  cgContactList.querySelectorAll('.cg-contact-item').forEach(function(el) {
    el.addEventListener('click', function() {
      var id = el.dataset.id;
      if (cgSelected.has(id)) cgSelected.delete(id); else cgSelected.add(id);
      el.classList.toggle('selected');
    });
  });
}

cgSearchInput.addEventListener('input', function() {
  var q = cgSearchInput.value.trim().toLowerCase();
  var items = Array.from(contacts.values()).filter(function(c) { return c.id !== currentUser.id && c.name.toLowerCase().includes(q); });
  renderCgContactList(items);
});

cgCreateBtn.addEventListener('click', async function() {
  var name = cgNameInput.value.trim();
  if (!name) { showToast('请输入群名称'); return; }
  if (cgSelected.size < 1) { showToast('请选择至少一位群成员'); return; }
  cgCreateBtn.disabled = true;
  cgCreateBtn.textContent = '创建中...';
  try {
    var group = await Api.createGroup(name, Array.from(cgSelected));
    cgSelected.clear();
    hideBsModal(createGroupModal);
    myGroups.push(group);
    contacts.set(group.id, { id: group.id, name: group.name, avatar: null, avatarColor: group.avatarColor, avatarChar: group.avatarChar, online: true });
    openChat(group.id);
    showToast('群聊创建成功');
  } catch (e) {
    showToast(e.message || '创建失败');
  }
  cgCreateBtn.disabled = false;
  cgCreateBtn.textContent = '创建群聊';
});

// 群信息弹窗
function openGroupInfo(groupId) {
  Api.getGroupInfo(groupId).then(function(g) {
    giAvatar.textContent = g.avatarChar || '群';
    giAvatar.style.background = g.avatarColor || '#3498db';
    giName.textContent = g.name + '（' + g.memberCount + '人）';
    giCount.textContent = g.memberCount + ' 位成员';
    var me = g.members ? g.members.find(function(m) { return m.userId === currentUser.id; }) : null;
    var isOwner = me && me.role === 'owner';
    var isAdmin = me && me.role === 'admin';
    var html = '<div style="margin:.5rem 0;padding:.5rem;background:rgba(255,255,255,.04);border-radius:8px;font-size:.78rem;color:#aaa">';
    if (g.notice) { html += '📢 ' + escapeHtml(g.notice); } else { html += '暂无群公告'; }
    if (isOwner || isAdmin) html += '<br><span id="editNoticeBtn" style="color:var(--green);cursor:pointer;font-size:.72rem">编辑公告</span>';
    html += '</div><div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.5rem">';
    if (isOwner || isAdmin) html += '<button class="gi-action-btn" onclick="showToast(' + "'" + '搜索群名称让好友加入' + "'" + ')">➕ 添加</button>';
    if (isOwner) html += '<button class="gi-action-btn" onclick="doMuteAll(' + "'" + g.id + "'" + ')">🔇 全员禁言</button>';
    if (isOwner) html += '<button class="gi-action-btn" onclick="doTransferGroup(' + "'" + g.id + "'" + ')">🔄 转让群</button>';
    if (isOwner) html += '<button class="gi-action-btn" style="color:var(--danger)" onclick="doDisbandGroup(' + "'" + g.id + "'" + ')">🗑 解散群</button>';
    html += '</div>';
    giActions.innerHTML = html;
    var editBtn = document.getElementById('editNoticeBtn');
    if (editBtn) {
      editBtn.addEventListener('click', function() {
        var n = prompt('输入群公告：', g.notice || '');
        if (n !== null) Api.setGroupNotice(g.id, n).then(function() { openGroupInfo(g.id); }).catch(function(e) { showToast(e.message); });
      });
    }
    giMembers.innerHTML = (g.memberDetails || []).map(function(m) {
      var rl = m.role === 'owner' ? '👑群主' : (m.role === 'admin' ? '管理员' : '');
      var cr = (isOwner && m.role !== 'owner') || (isAdmin && m.role === 'member');
      var csa = isOwner && m.role === 'member';
      var nm = m.user ? m.user.name : m.userId;
      var ah = (m.user && m.user.avatar) ? '<img src="' + m.user.avatar + '">' : (m.user ? m.user.avatarChar || '?' : '?');
      var ab = (m.user && m.user.avatar) ? '' : (m.user ? m.user.avatarColor || '#666' : '#666');
      var buttonsHtml = '';
      if (csa) buttonsHtml += '<button class="gi-member-action" onclick="doSetRole(' + "'" + g.id + "','" + m.userId + "','admin'" + ')">设为管理</button>';
      if (cr) buttonsHtml += '<button class="gi-member-action" onclick="doRemoveMember(' + "'" + g.id + "','" + m.userId + "'" + ')">移除</button>';
      return '<div class="gi-member"><div class="avatar" style="background:' + ab + '">' + ah + '</div><span class="gi-member-name">' + escapeHtml(nm) + '</span><span class="gi-member-role">' + rl + '</span>' + buttonsHtml + '</div>';
    }).join('');
    showBsModal(groupInfoModal);
  }).catch(function(e) { showToast(e.message || '获取群信息失败'); });
}
window.openGroupInfo = openGroupInfo;

function doMuteAll(gid) {
  if (confirm('全员禁言？（仅群主可发言）')) {
    Api.setGroupNotice(gid, '全体禁言').then(function() { showToast('已禁言'); }).catch(function(e) { showToast(e.message || '失败'); });
  }
}
window.doMuteAll = doMuteAll;

function doTransferGroup(gid) {
  var n = prompt('输入新群主的用户ID/昵称：');
  if (!n) return;
  Api.getGroupInfo(gid).then(function(g) {
    var m = null;
    if (g.memberDetails) {
      m = g.memberDetails.find(function(mm) {
        return mm.user && ((mm.user.name && mm.user.name.indexOf(n) >= 0) || mm.userId.indexOf(n) >= 0);
      });
    }
    if (!m) { showToast('未找到该成员'); return; }
    var name = m.user ? m.user.name : m.userId;
    if (confirm('转让给 ' + name + '？')) {
      Api.setGroupRole(gid, m.userId, 'owner').then(function() { showToast('已转让'); }).catch(function(e) { showToast(e.message || '失败'); });
    }
  });
}
window.doTransferGroup = doTransferGroup;

function doDisbandGroup(gid) {
  if (confirm('确定解散此群？不可撤销！')) {
    Api.dissolveGroup(gid).then(function() {
      showToast('群已解散'); hideBsModal(groupInfoModal);
      myGroups = myGroups.filter(function(g) { return g.id !== gid; });
      contacts.delete(gid);
      if (activeChat === gid) { activeChat = null; chatWindow.style.display = 'none'; emptyState.style.display = 'flex'; }
      renderChatList(); renderContactList();
    }).catch(function(e) { showToast(e.message || '失败'); });
  }
}
window.doDisbandGroup = doDisbandGroup;

giModalOverlay.onclick = giModalClose.onclick = function() { hideBsModal(groupInfoModal); };

function doSetRole(groupId, userId, role) {
  Api.setGroupRole(groupId, userId, role).then(function() { showToast('已设置管理员'); openGroupInfo(groupId); }).catch(function(e) { showToast(e.message || '操作失败'); });
}
window.doSetRole = doSetRole;

function doRemoveMember(groupId, userId) {
  if (!confirm('确定移除此成员？')) return;
  Api.muteGroupMember(groupId, userId, true).then(function() { showToast('已移除'); openGroupInfo(groupId); }).catch(function(e) { showToast(e.message || '操作失败'); });
}
window.doRemoveMember = doRemoveMember;

// ═══════════════════════════════════════════════════════════════
// 退出登录
// ═══════════════════════════════════════════════════════════════
function doLogout() {
  if (confirm('确定退出登录？')) {
    TokenManager.clear();
    if (sseClient) sseClient.disconnect();
    sseClient = null;
    myFriends = []; myGroups = []; pendingReqs = [];
    contacts = new Map(); messageCache = new Map();
    currentUser = null; activeChat = null;
    location.reload();
  }
}
logoutBtn.addEventListener('click', doLogout);
ppLogout.addEventListener('click', doLogout);

// ═══════════════════════════════════════════════════════════════
// Tab 切换
// ═══════════════════════════════════════════════════════════════
tabs.forEach(function(tab) {
  tab.addEventListener('click', function() {
    tabs.forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    var target = tab.dataset.tab;
    chatList.classList.toggle('active', target === 'chats');
    contactList.classList.toggle('active', target === 'contacts');
    profilePanel.classList.toggle('active', target === 'profile');
    if (target === 'profile') updateProfileUI();
  });
});

// ═══════════════════════════════════════════════════════════════
// 搜索聊天
// ═══════════════════════════════════════════════════════════════
searchChat.addEventListener('input', function() {
  var q = searchChat.value.trim().toLowerCase();
  document.querySelectorAll('.chat-item, .contact-item').forEach(function(el) {
    var nameEl = el.querySelector('.chat-item-name, .contact-name');
    var name = nameEl ? nameEl.textContent.toLowerCase() : '';
    el.style.display = name.indexOf(q) >= 0 ? 'flex' : 'none';
  });
});

// ═══════════════════════════════════════════════════════════════
// 聊天列表渲染
// ═══════════════════════════════════════════════════════════════
function renderChatList() {
  var items = [];
  contacts.forEach(function(user, id) {
    if (id === currentUser.id) return;
    var chatId = getChatId(currentUser.id, id);
    var msgs = messageCache.get(chatId) || [];
    var lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
    var unread = msgs.filter(function(m) { return m.from === id && m.to === currentUser.id && m.status !== 'read'; }).length;
    items.push({ user: user, lastMsg: lastMsg, unread: unread, time: lastMsg ? lastMsg.time : 0 });
  });
  items.sort(function(a, b) { return b.time - a.time; });

  chatList.innerHTML = items.map(function(c) {
    var u = c.user;
    var chatId = getChatId(currentUser.id, u.id);
    var settings = getLocalChatSettings(chatId);
    var avatarHtml = u.avatar ? '<img src="' + u.avatar + '" alt="">' : (u.avatarChar || '?');
    var avatarBg = u.avatar ? '' : (u.avatarColor || '#666');
    var lastText = '暂无消息';
    if (c.lastMsg) {
      if (c.lastMsg.type === 'recalled') {
        lastText = c.lastMsg.from === currentUser.id ? '你撤回了一条消息' : '对方撤回了一条消息';
      } else if (c.lastMsg.type === 'redpacket') {
        lastText = c.lastMsg.redpacket && c.lastMsg.redpacket.opened ? '已领取红包' : '🧧 红包';
      } else {
        lastText = escapeHtml(c.lastMsg.text.slice(0, 30)) + (c.lastMsg.text.length > 30 ? '...' : '');
      }
    }
    var timeStr = c.lastMsg ? formatTime(c.lastMsg.time) : '';
    var isActive = activeChat === u.id;
    var nameHtml = escapeHtml(u.name);
    if (settings && settings.pinned) nameHtml += ' 📌';
    if (settings && settings.muted) nameHtml += ' 🔇';
    var unreadHtml = '';
    if (c.unread > 0 && (!settings || !settings.muted)) {
      unreadHtml = '<div class="unread-badge badge bg-danger rounded-pill">' + (c.unread > 99 ? '99+' : c.unread) + '</div>';
    }
    return '<div class="chat-item ' + (isActive ? 'active' : '') + '" onclick="openChat(\'' + u.id + '\')" data-pinned="' + ((settings && settings.pinned) ? '1' : '0') + '"><div class="avatar" style="background:' + avatarBg + '">' + avatarHtml + '<span class="online-dot ' + (u.online ? '' : 'offline') + '"></span></div><div class="chat-item-info"><div class="chat-item-name">' + nameHtml + '</div><div class="chat-item-preview">' + lastText + '</div></div><div class="chat-item-right"><div class="chat-item-time">' + timeStr + '</div>' + unreadHtml + '<div style="display:flex;gap:2px;margin-top:4px"><span class="chat-action-btn" onclick="event.stopPropagation();togglePin(\'' + u.id + '\')" title="' + ((settings && settings.pinned) ? '取消置顶' : '置顶') + '">📌</span><span class="chat-action-btn" onclick="event.stopPropagation();toggleMute(\'' + u.id + '\')" title="' + ((settings && settings.muted) ? '取消免打扰' : '免打扰') + '">🔇</span><span class="chat-action-btn" onclick="event.stopPropagation();deleteChat(\'' + u.id + '\')" title="删除聊天">🗑</span></div></div></div>';
  }).join('');

  var parent = chatList;
  var pinnedItems = parent.querySelectorAll('[data-pinned="1"]');
  pinnedItems.forEach(function(el) { parent.insertBefore(el, parent.firstChild); });

  if (items.length === 0) {
    chatList.innerHTML = '<div style="text-align:center;padding:2rem 1rem;color:#666;font-size:.82rem"><p style="font-size:2rem;margin-bottom:.5rem">💬</p><p>暂无聊天记录</p><p style="margin-top:.3rem;font-size:.75rem;color:#888">点击右上角 ➕ 添加好友</p></div>';
  }
}

// ═══════════════════════════════════════════════════════════════
// 联系人列表渲染
// ═══════════════════════════════════════════════════════════════
function loadFriends() {
  Api.getFriends().then(function(list) { myFriends = list || []; renderContactList(); }).catch(function() {});
  Api.getFriendRequests().then(function(list) { pendingReqs = list || []; renderContactList(); }).catch(function() {});
}

function renderContactList() {
  contactList.innerHTML = '';
  var pendingCount = pendingReqs.filter(function(r) { return r.status === 'pending'; }).length;
  var frHtml = '<div class="contact-item" id="newFriendsBtn" style="cursor:pointer"><div class="avatar" style="background:#f90;border-radius:50%">👤</div><div style="flex:1;min-width:0"><div class="contact-name">新的朋友</div><div class="contact-status">' + (pendingCount > 0 ? pendingCount + '个待处理' : '暂无申请') + '</div></div>' + (pendingCount > 0 ? '<div class="unread-badge badge bg-danger rounded-pill">' + pendingCount + '</div>' : '') + '</div>';
  contactList.innerHTML += frHtml;

  if (myFriends.length === 0) {
    contactList.innerHTML += '<div style="text-align:center;padding:1.5rem 1rem;color:#666;font-size:.78rem"><p>暂无好友，点击上方「新的朋友」搜索添加</p></div>';
  } else {
    var sorted = myFriends.slice().sort(function(a, b) { return a.name.localeCompare(b.name, 'zh-CN'); });
    var lastLetter = '';
    sorted.forEach(function(u) {
      var letter = u.name.charAt(0).toUpperCase();
      if (letter !== lastLetter) {
        contactList.innerHTML += '<div style="padding:.4rem .8rem .2rem;font-size:.72rem;color:#666;font-weight:600">' + letter + '</div>';
        lastLetter = letter;
      }
      var avatarHtml = u.avatar ? '<img src="' + u.avatar + '" alt="">' : (u.avatarChar || '?');
      var avatarBg = u.avatar ? '' : (u.avatarColor || '#666');
      contactList.innerHTML += '<div class="contact-item" onclick="openChat(\'' + u.id + '\')"><div class="avatar" style="background:' + avatarBg + '">' + avatarHtml + '<span class="online-dot ' + (u.online ? '' : 'offline') + '"></span></div><div style="flex:1;min-width:0"><div class="contact-name">' + escapeHtml(u.name) + (u.realNameVerified ? '<span style="font-size:.6rem;color:#1aad19">✓</span>' : '') + '</div><div class="contact-status">' + (u.online ? '在线' : '离线') + '</div></div></div>';
    });
  }

  if (myGroups.length > 0) {
    contactList.innerHTML += '<div style="padding:.5rem .8rem .2rem;font-size:.72rem;color:#666;font-weight:600;border-top:1px solid rgba(255,255,255,.05);margin-top:.3rem">群聊 (' + myGroups.length + ')</div>';
    myGroups.forEach(function(g) {
      contactList.innerHTML += '<div class="contact-item" onclick="openChat(\'' + g.id + '\')"><div class="avatar" style="background:' + (g.avatarColor||'#3498db') + '">' + (g.avatarChar||'群') + '</div><div style="flex:1;min-width:0"><div class="contact-name">' + escapeHtml(g.name) + '</div><div class="contact-status">' + (g.memberCount||'?') + '人</div></div></div>';
    });
  }
}

// 点击新的朋友
document.addEventListener('click', function(e) {
  var frBtn = document.getElementById('newFriendsBtn');
  if (frBtn && (frBtn === e.target || frBtn.contains(e.target))) showFriendRequests();
});

function showFriendRequests() {
  document.querySelectorAll('.tab-content').forEach(function(t) { t.classList.remove('active'); });
  document.getElementById('friendRequestPage').classList.add('active');
  renderFriendRequests();
}

document.getElementById('frBackBtn').addEventListener('click', function() {
  document.getElementById('friendRequestPage').classList.remove('active');
  var contactTab = document.querySelector('[data-tab="contacts"]');
  if (contactTab) contactTab.click();
});

function renderFriendRequests() {
  var el = document.getElementById('friendRequestList');
  var all = pendingReqs || [];
  var pending = all.filter(function(r) { return r.status === 'pending'; });
  var history = all.filter(function(r) { return r.status !== 'pending'; });

  var html = '<p style="font-size:.82rem;color:#888;margin-bottom:.5rem">搜索用户添加好友</p>';
  html += '<div style="display:flex;gap:.3rem;margin-bottom:.8rem"><input type="text" id="frSearchInput" placeholder="输入手机号搜索..." style="flex:1;padding:.4rem .6rem;border-radius:6px;border:1px solid #444;background:#3a3a3a;color:#ddd;font-size:.8rem;outline:none"><button id="frSearchBtn" style="padding:.4rem .7rem;border:none;border-radius:6px;background:var(--green);color:#fff;font-size:.78rem;cursor:pointer">搜索</button></div><div id="frSearchResult" style="margin-bottom:.5rem"></div>';

  if (pending.length > 0) {
    html += '<div style="font-size:.78rem;color:#888;margin:.3rem 0">待处理 (' + pending.length + ')</div>';
    pending.forEach(function(r) {
      var u = r.fromUser || { name: r.from, avatarChar: '?', avatarColor: '#666' };
      html += '<div style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0;border-bottom:1px solid rgba(255,255,255,.04)"><div class="avatar" style="width:34px;height:34px;background:' + (u.avatarColor||'#666') + ';font-size:.7rem">' + (u.avatarChar||'?') + '</div><div style="flex:1"><div style="font-size:.82rem">' + escapeHtml(u.name||r.from) + '</div><div style="font-size:.7rem;color:#888">' + escapeHtml(r.remark||'') + '</div></div><button class="add-btn" onclick="acceptFriend(\'' + r.from + '\')" style="padding:.2rem .5rem;border:none;border-radius:6px;background:var(--green);color:#fff;font-size:.72rem;cursor:pointer">同意</button><button class="add-btn" onclick="rejectFriend(\'' + r.from + '\')" style="padding:.2rem .5rem;border:none;border-radius:6px;background:#888;color:#fff;font-size:.72rem;cursor:pointer">拒绝</button></div>';
    });
  } else {
    html += '<div style="text-align:center;padding:.8rem;color:#888;font-size:.78rem">暂无好友申请</div>';
  }

  if (history.length > 0) {
    html += '<div style="font-size:.78rem;color:#888;margin:.5rem 0 .3rem">历史记录</div>';
    history.forEach(function(r) {
      var u = r.fromUser || { name: r.from, avatarChar: '?', avatarColor: '#666' };
      var statusLabel = r.status === 'accepted' ? '已添加' : '已拒绝';
      html += '<div style="display:flex;align-items:center;gap:.5rem;padding:.3rem 0;opacity:.6"><div class="avatar" style="width:30px;height:30px;background:' + (u.avatarColor||'#666') + ';font-size:.65rem">' + (u.avatarChar||'?') + '</div><div style="flex:1"><div style="font-size:.78rem">' + escapeHtml(u.name||r.from) + '</div></div><span style="font-size:.7rem;color:#888">' + statusLabel + '</span></div>';
    });
  }

  el.innerHTML = html;

  document.getElementById('frSearchBtn').addEventListener('click', async function() {
    var q = document.getElementById('frSearchInput').value.trim();
    if (!q) return;
    try {
      var users = await Api.searchUsers(q);
      var resultEl = document.getElementById('frSearchResult');
      if (!users || users.length === 0) { resultEl.innerHTML = '<p style="font-size:.75rem;color:#888;padding:.3rem 0">未找到用户</p>'; return; }
      resultEl.innerHTML = users.map(function(u) {
        var isFriend = myFriends.some(function(f) { return f.id === u.id; });
        return '<div style="display:flex;align-items:center;gap:.5rem;padding:.3rem 0"><div class="avatar" style="width:32px;height:32px;background:' + (u.avatarColor||'#666') + ';font-size:.7rem">' + (u.avatarChar||'?') + '</div><div style="flex:1;font-size:.8rem">' + escapeHtml(u.name) + '</div>' + (isFriend ? '<span style="font-size:.7rem;color:#888">已是好友</span>' : '<button class="add-btn" onclick="sendFriendReq(\'' + u.id + '\')" style="padding:.2rem .5rem;border:none;border-radius:6px;background:var(--green);color:#fff;font-size:.72rem;cursor:pointer">添加</button>') + '</div>';
      }).join('');
    } catch (e) {
      document.getElementById('frSearchResult').innerHTML = '<p style="font-size:.75rem;color:#888;padding:.3rem 0">搜索失败</p>';
    }
  });
}

function sendFriendReq(userId) {
  Api.sendFriendRequest(userId).then(function() { showToast('已发送好友请求'); }).catch(function(e) { showToast(e.message || '发送失败'); });
}
window.sendFriendReq = sendFriendReq;

function acceptFriend(from) {
  Api.acceptFriendRequest(from).then(function() { showToast('已添加好友'); loadFriends(); }).catch(function(e) { showToast(e.message || '操作失败'); });
}
window.acceptFriend = acceptFriend;

function rejectFriend(from) {
  Api.rejectFriendRequest(from).then(function() { showToast('已拒绝'); loadFriends(); }).catch(function(e) { showToast(e.message || '操作失败'); });
}
window.rejectFriend = rejectFriend;

// ═══════════════════════════════════════════════════════════════
// 打开聊天
// ═══════════════════════════════════════════════════════════════
function openChat(userId) {
  activeChat = userId;
  var user = contacts.get(userId);
  if (!user) return;
  var isGroup = userId.startsWith('g_');
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
  var chatId = isGroup ? userId : getChatId(currentUser.id, userId);
  if (!messageCache.has(chatId) || messageCache.get(chatId).length === 0) {
    showMessageLoading();
    Api.getMessages(chatId, 50, 0).then(function(msgs) {
      messageCache.set(chatId, msgs || []);
      hideMessageLoading();
      renderMessages();
      scrollToBottom();
      if (!isGroup) markAsReadViaApi(userId);
    }).catch(function() {
      hideMessageLoading();
      messageCache.set(chatId, []);
      renderMessages();
    });
  } else {
    renderMessages();
    scrollToBottom();
    if (!isGroup) markAsReadViaApi(userId);
  }
}
window.openChat = openChat;

function startChat(userId) {
  hideBsModal(addContactModal);
  if (!contacts.has(userId)) {
    Api.searchUsers(userId).then(function(users) {
      var u = null;
      if (users) u = users.find(function(x) { return x.id === userId; });
      if (u) { contacts.set(userId, u); openChat(userId); }
    }).catch(function() {});
  } else {
    openChat(userId);
  }
}
window.startChat = startChat;

function clearUnread(userId) {
  var chatId = getChatId(currentUser.id, userId);
  var msgs = messageCache.get(chatId);
  if (msgs) {
    msgs.forEach(function(m) {
      if (m.from === userId && m.to === currentUser.id && m.status !== 'read') {
        m.status = 'read';
        m.readAt = Date.now();
      }
    });
  }
}

function markAsReadViaApi(userId) {
  var chatId = getChatId(currentUser.id, userId);
  var msgs = messageCache.get(chatId);
  if (!msgs) return;
  msgs.forEach(function(m) {
    if (m.from === userId && m.to === currentUser.id && m.status !== 'read') {
      m.status = 'read';
      m.readAt = Date.now();
    }
  });
  renderMessages();
}

function updateChatHeader(userId) {
  var user = contacts.get(userId);
  if (!user) return;
  var isGroup = userId.startsWith('g_');
  var avatarHtml = user.avatar ? '<img src="' + user.avatar + '" alt="">' : (user.avatarChar || '?');
  var avatarBg = user.avatar ? '' : (user.avatarColor || '#666');
  chatAvatar.innerHTML = avatarHtml;
  chatAvatar.style.background = avatarBg;
  chatName.textContent = user.name;
  if (isGroup) {
    chatStatus.textContent = '群聊';
    chatStatus.style.color = '#888';
    chatAvatar.style.cursor = 'pointer';
    chatAvatar.onclick = function() { openGroupInfo(userId); };
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
  var isGroup = activeChat.startsWith('g_');
  var chatId = isGroup ? activeChat : getChatId(currentUser.id, activeChat);
  var msgs = messageCache.get(chatId) || [];
  var user = contacts.get(activeChat);

  if (msgs.length === 0 && messagesContainer.querySelector('.message-row') === null) {
    msgLoadingSkeleton.style.display = 'flex';
  } else {
    msgLoadingSkeleton.style.display = 'none';
  }

  var lastDate = '';
  var html = '';
  var prevTime = 0;

  if (msgs.length > 20) {
    html += '<div class="load-more" onclick="alert(\'查看更多消息\')">查看更多消息</div>';
  }

  msgs.forEach(function(m, idx) {
    var msgDate = new Date(m.time).toDateString();
    if (msgDate !== lastDate) {
      html += '<div class="date-divider"><span>' + formatDate(m.time) + '</span></div>';
      lastDate = msgDate;
    }
    m._smartTimeHtml = formatTimeSmart(m.time, prevTime);
    if (m.type !== 'recalled' && m.type !== 'system') prevTime = m.time;
    html += renderMessageHtml(m, user, activeChat.startsWith('g_'));
  });

  messagesContainer.innerHTML = html;

  messagesContainer.querySelectorAll('.rp-bubble').forEach(function(el) {
    el.addEventListener('click', function() {
      var msgId = el.dataset.msgId;
      var msgs = messageCache.get(chatId) || [];
      var msg = msgs.find(function(m) { return m.id === msgId; });
      if (msg && msg.type === 'redpacket') handleRedpacketClick(msg);
    });
  });

  messagesContainer.querySelectorAll('.recall-action').forEach(function(el) {
    el.addEventListener('click', function() {
      var msgId = el.dataset.msgId;
      recallMessage(msgId);
    });
  });

  messagesContainer.querySelectorAll('.message-row').forEach(function(row) {
    var longPressTimer2 = null;
    row.addEventListener('touchstart', function(e) {
      longPressTimer2 = setTimeout(function() {
        if (selectionToolbar.style.display === 'flex') {
          selectedMsgIds.add(row.dataset.msgId);
          row.classList.add('selected');
          selectionCount.textContent = '已选 ' + selectedMsgIds.size + ' 条';
        } else {
          var bubble = row.querySelector('.message-bubble, .file-bubble, .voice-bubble, img.message-image, .rp-bubble');
          if (bubble) showReactionPanel(row.dataset.msgId, bubble);
        }
      }, 500);
    }, { passive: true });
    row.addEventListener('touchend', function() { if (longPressTimer2) clearTimeout(longPressTimer2); });
    row.addEventListener('touchmove', function() { if (longPressTimer2) clearTimeout(longPressTimer2); });
  });

  messagesContainer.querySelectorAll('.file-bubble').forEach(function(el) {
    el.addEventListener('click', function() {
      var url = el.dataset.url;
      var mime = el.dataset.mime || '';
      var name = el.dataset.name || 'file';
      if (!url) return;
      if (mime.startsWith('image/')) { showImagePreview(url); }
      else if (mime.startsWith('video/')) { window.open(url, '_blank'); }
      else if (mime.startsWith('audio/')) { var audio = new Audio(url); audio.play(); }
      else { var a = document.createElement('a'); a.href = url; a.download = name; a.target = '_blank'; a.click(); }
    });
  });

  messagesContainer.querySelectorAll('.reaction-badge').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      var msgRow = this.closest('.message-row');
      if (msgRow) {
        var msgId = msgRow.dataset.msgId;
        var emoji = this.dataset.emoji;
        if (msgId && emoji) {
          var chatId2 = activeChat.startsWith('g_') ? activeChat : getChatId(currentUser.id, activeChat);
          var msgs4 = messageCache.get(chatId2) || [];
          for (var i = 0; i < msgs4.length; i++) {
            if (msgs4[i].id === msgId) {
              if (!msgs4[i].reactions) msgs4[i].reactions = [];
              var existingIdx = -1;
              for (var j = 0; j < msgs4[i].reactions.length; j++) {
                if (msgs4[i].reactions[j].emoji === emoji && msgs4[i].reactions[j].userId === currentUser.id) { existingIdx = j; break; }
              }
              if (existingIdx >= 0) { msgs4[i].reactions.splice(existingIdx, 1); }
              else { msgs4[i].reactions.push({ emoji: emoji, userId: currentUser.id }); }
              break;
            }
          }
          renderMessages();
        }
      }
    });
  });
}

function renderMessageHtml(m, chatPartner, isGroup) {
  var isMine = m.from === currentUser.id;
  var sender = isMine ? currentUser : chatPartner;
  var senderName = isGroup && !isMine ? (contacts.get(m.from) ? contacts.get(m.from).name : m.from) : null;
  var avatarHtml = sender && sender.avatar ? '<img src="' + sender.avatar + '" alt="">' : (sender ? sender.avatarChar || '?' : '?');
  var avatarBg = sender && sender.avatar ? '' : (sender ? sender.avatarColor || '#999' : '#999');
  var timeStr = m._smartTimeHtml || formatTime(m.time);

  if (m.type === 'recalled') {
    var recallText = isMine ? '你撤回了一条消息' : '对方撤回了一条消息';
    var elapsed = Date.now() - m.time;
    var canReEdit = isMine && elapsed <= 60000;
    return '<div class="message-row recalled" data-msg-id="' + m.id + '" data-chat-id="' + getChatId(currentUser.id, activeChat) + '"><div class="message-body" style="max-width:100%"><div class="message-bubble">' + recallText + '</div><div style="display:flex;align-items:center;gap:.5rem;justify-content:center;margin-top:2px"><span class="recall-hint">' + timeStr + '</span>' + (canReEdit ? '<span class="recall-hint recall-action" data-msg-id="' + m.id + '" style="cursor:pointer;color:#1aad19">重新编辑</span>' : '') + '</div></div></div>';
  }

  if (m.type === 'redpacket') {
    var opened = m.redpacket && m.redpacket.opened;
    var statusText = opened ? '已领取' : (isMine ? (m.status === 'delivered' || m.status === 'read' ? '等待领取' : '已发送') : '点击领取');
    return '<div class="message-row ' + (isMine ? 'mine' : 'other') + '" data-msg-id="' + m.id + '" data-chat-id="' + getChatId(currentUser.id, activeChat) + '"><div class="message-avatar" style="background:' + avatarBg + '">' + avatarHtml + '</div><div class="message-body"><div class="rp-bubble" data-msg-id="' + m.id + '"><div class="rp-bubble-icon">🧧</div><div class="rp-bubble-info"><div class="rp-bubble-title">' + escapeHtml(m.text) + '</div><div class="rp-bubble-sub">' + (isMine ? '你发了一个红包' : '红包') + '</div><div class="rp-bubble-status">' + statusText + '</div></div><div class="rp-bubble-amount">' + (opened ? '已拆开' : '?') + '</div></div><div class="message-footer"><span class="message-time">' + timeStr + '</span></div></div></div>';
  }

  if (m.type === 'image') {
    var statusIcon = isMine ? getStatusSvg(m.status) : '';
    var imgSrc = m.imageUrl || m.text || '';
    return '<div class="message-row ' + (isMine ? 'mine' : 'other') + '" data-msg-id="' + m.id + '" data-chat-id="' + getChatId(currentUser.id, activeChat) + '"><div class="message-avatar" style="background:' + avatarBg + '">' + avatarHtml + '</div><div class="message-body">' + (senderName ? '<div style="font-size:.7rem;color:#888;margin-bottom:1px;padding-left:2px">' + escapeHtml(senderName) + '</div>' : '') + '<img class="message-image" src="' + imgSrc + '" alt="图片" onclick="showImagePreview(\'' + imgSrc + '\')"><div class="message-footer"><span class="message-time">' + timeStr + '</span>' + statusIcon + '</div>' + renderReactions(m.reactions) + '</div></div>';
  }

  if (m.type === 'voice') {
    var statusIcon = isMine ? getStatusSvg(m.status) : '';
    var dur = m.duration || 0;
    var durStr = Math.floor(dur / 60) + ':' + String(dur % 60).padStart(2, '0');
    var audioUrl = m.text || '';
    return '<div class="message-row ' + (isMine ? 'mine' : 'other') + '" data-msg-id="' + m.id + '" data-chat-id="' + getChatId(currentUser.id, activeChat) + '"><div class="message-avatar" style="background:' + avatarBg + '">' + avatarHtml + '</div><div class="message-body">' + (senderName ? '<div style="font-size:.7rem;color:#888;margin-bottom:1px;padding-left:2px">' + escapeHtml(senderName) + '</div>' : '') + '<div class="voice-bubble ' + (isMine ? 'mine' : 'other') + '" data-url="' + audioUrl + '" data-msg-id="' + m.id + '" data-playing="false"><i class="bi bi-play-fill voice-play-icon"></i><span class="voice-duration">' + durStr + '</span><span class="voice-unread-dot" style="' + (m.status === 'sent' && !isMine ? '' : 'display:none') + '"></span></div><div class="message-footer"><span class="message-time">' + timeStr + '</span>' + statusIcon + '</div>' + renderReactions(m.reactions) + '</div></div>';
  }

  if (m.type === 'file') {
    var statusIcon = isMine ? getStatusSvg(m.status) : '';
    var fileIcon = getFileIcon(m.fileName || '');
    var fileSizeStr = formatFileSize(m.fileSize || 0);
    return '<div class="message-row ' + (isMine ? 'mine' : 'other') + '" data-msg-id="' + m.id + '" data-chat-id="' + getChatId(currentUser.id, activeChat) + '"><div class="message-avatar" style="background:' + avatarBg + '">' + avatarHtml + '</div><div class="message-body">' + (senderName ? '<div style="font-size:.7rem;color:#888;margin-bottom:1px;padding-left:2px">' + escapeHtml(senderName) + '</div>' : '') + '<div class="file-bubble ' + (isMine ? 'mine' : 'other') + '" data-url="' + (m.fileUrl || '') + '" data-mime="' + (m.mimeType || '') + '" data-name="' + escapeHtml(m.fileName || '') + '"><span class="file-icon">' + fileIcon + '</span><div class="file-info"><div class="file-name" title="' + escapeHtml(m.fileName || '') + '">' + escapeHtml(m.fileName || '未知文件') + '</div><div class="file-size">' + fileSizeStr + '</div></div></div><div class="message-footer"><span class="message-time">' + timeStr + '</span>' + statusIcon + '</div>' + renderReactions(m.reactions) + '</div></div>';
  }

  // 普通文本消息
  var statusIcon = isMine ? getStatusSvg(m.status) : '';
  return '<div class="message-row ' + (isMine ? 'mine' : 'other') + '" data-msg-id="' + m.id + '" data-chat-id="' + getChatId(currentUser.id, activeChat) + '"><div class="message-avatar" style="background:' + avatarBg + '">' + avatarHtml + '</div><div class="message-body">' + (senderName ? '<div style="font-size:.7rem;color:#888;margin-bottom:1px;padding-left:2px">' + escapeHtml(senderName) + '</div>' : '') + '<div class="message-bubble">' + renderMentions(m.text || '') + '</div><div class="message-footer"><span class="message-time">' + timeStr + '</span>' + statusIcon + (isMine && canRecall(m) ? '<span class="recall-action" data-msg-id="' + m.id + '" style="font-size:.6rem;color:#999;cursor:pointer;margin-left:2px">撤回</span>' : '') + '</div>' + renderReactions(m.reactions) + '</div></div>';
}

function getStatusSvg(status) {
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
  if (msg.type !== 'text' && msg.type !== 'image' && msg.type !== 'voice' && msg.type !== 'file') return false;
  return (Date.now() - msg.time) < 180000;
}

function getFileIcon(fileName) {
  if (!fileName) return '📎';
  var parts = fileName.split('.');
  var ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  var map = { pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', ppt: '📑', pptx: '📑', zip: '📦', rar: '📦', '7z': '📦', tar: '📦', gz: '📦', mp4: '🎬', avi: '🎬', mov: '🎬', mkv: '🎬', flv: '🎬', mp3: '🎵', wav: '🎵', flac: '🎵', aac: '🎵', ogg: '🎵', jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🖼️', txt: '📃', csv: '📃', json: '📋', js: '📋', ts: '📋', html: '🌐', css: '🎨', exe: '⚙️', apk: '📱', dmg: '💿' };
  return map[ext] || '📎';
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  var units = ['B', 'KB', 'MB', 'GB'];
  var i = 0;
  var size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return size.toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

function scrollToBottom() {
  setTimeout(function() { messagesContainer.scrollTop = messagesContainer.scrollHeight; }, 20);
}

// ═══════════════════════════════════════════════════════════════
// 发送消息
// ═══════════════════════════════════════════════════════════════
async function sendMessage() {
  var text = messageInput.value.trim();
  if (!text || !activeChat) return;
  try {
    var msg = await Api.sendMessage(activeChat, text, 1);
    var chatId = activeChat.startsWith('g_') ? activeChat : getChatId(currentUser.id, activeChat);
    if (!messageCache.has(chatId)) messageCache.set(chatId, []);
    messageCache.get(chatId).push(msg);
    renderMessages(); scrollToBottom(); renderChatList();
  } catch (e) {
    showToast(e.message || '发送失败', 2000, 'error');
  }
  messageInput.value = ''; emojiPanel.style.display = 'none'; updateSendBtn();
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
messageInput.addEventListener('input', updateSendBtn);

function updateSendBtn() {
  if (!sendBtn || !messageInput) return;
  sendBtn.disabled = !messageInput.value.trim();
}

// ─── Image upload ──────────────────────────────────────────
async function sendImageData(dataUrl) {
  if (!dataUrl || !activeChat) return;
  var estimatedBytes = dataUrl.length * 0.75;
  if (estimatedBytes > 5 * 1024 * 1024) { showToast('图片不能超过 5MB', 2000, 'error'); return; }
  showToast('上传中...', 3000);
  try {
    var msg = await Api.sendMessage(activeChat, dataUrl, 3);
    var chatId = activeChat.startsWith('g_') ? activeChat : getChatId(currentUser.id, activeChat);
    if (!messageCache.has(chatId)) messageCache.set(chatId, []);
    messageCache.get(chatId).push(msg);
    renderMessages(); scrollToBottom(); renderChatList();
  } catch (e) {
    showToast(e.message || '图片发送失败', 2000, 'error');
  }
}

imageBtn.addEventListener('click', async function() {
  if (NativeBridge.isApp) {
    var dataUrl = await NativeBridge.pickImage();
    if (dataUrl) sendImageData(dataUrl);
  } else { imageInput.click(); }
});
imageInput.addEventListener('change', function(e) {
  var file = e.target.files[0];
  if (!file || !activeChat) return;
  if (file.size > 5 * 1024 * 1024) { showToast('图片不能超过 5MB', 2000, 'error'); return; }
  if (!file.type.startsWith('image/')) { showToast('请选择图片文件', 2000, 'error'); return; }
  showToast('上传中...', 3000);
  var reader = new FileReader();
  reader.onload = function(ev) { sendImageData(ev.target.result); };
  reader.readAsDataURL(file);
  imageInput.value = '';
});

// ─── File upload ──────────────────────────────────────────
fileBtn.addEventListener('click', function() { fileInput.click(); });
fileInput.addEventListener('change', async function(e) {
  var file = e.target.files[0];
  if (!file || !activeChat) return;
  if (file.size > 50 * 1024 * 1024) { showToast('文件不能超过 50MB', 2000, 'error'); return; }
  showToast('上传中...', 3000);
  try {
    var uploadResult = await Api.uploadFile(file);
    var msg = await Api.sendMessage(activeChat, uploadResult.url || uploadResult.dataUrl || '', 4);
    var chatId = activeChat.startsWith('g_') ? activeChat : getChatId(currentUser.id, activeChat);
    if (!messageCache.has(chatId)) messageCache.set(chatId, []);
    messageCache.get(chatId).push(msg);
    renderMessages(); scrollToBottom(); renderChatList();
  } catch (e) {
    showToast(e.message || '文件发送失败', 2000, 'error');
  }
  fileInput.value = '';
});

// ═══════════════════════════════════════════════════════════════
// 语音消息 — 录制
// ═══════════════════════════════════════════════════════════════
async function startRecording() {
  if (!activeChat) return;
  var hasMic = await NativeBridge.requestMicPermission();
  if (!hasMic) { showToast('请允许麦克风权限', 2000, 'error'); return; }
  try {
    var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    var mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg;codecs=opus';
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType: mimeType } : {});
    audioChunks = []; recordingStartTime = Date.now(); isRecording = true;
    mediaRecorder.ondataavailable = function(e) { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = function() {
      isRecording = false; stream.getTracks().forEach(function(t) { t.stop(); });
      var duration = Math.round((Date.now() - recordingStartTime) / 1000);
      if (duration < 1) { showToast('录音时间太短', 1500, 'error'); return; }
      sendVoiceMessage(audioChunks, duration);
    };
    mediaRecorder.onerror = function() { isRecording = false; stream.getTracks().forEach(function(t) { t.stop(); }); showToast('录音失败', 1500, 'error'); };
    mediaRecorder.start(100);
    showRecordingUI();
  } catch (e) {
    if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') { showToast('请允许麦克风权限', 2000, 'error'); }
    else { showToast('无法启动录音', 2000, 'error'); }
  }
}

function stopRecording() { if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop(); hideRecordingUI(); }
function cancelRecording() { if (mediaRecorder && mediaRecorder.state !== 'inactive') { mediaRecorder.stop(); audioChunks = []; } hideRecordingUI(); }
function showRecordingUI() { if (recordingOverlay) recordingOverlay.style.display = 'flex'; if (voiceBtn) voiceBtn.classList.add('recording'); startRecordingTimer(); }
function hideRecordingUI() { if (recordingOverlay) recordingOverlay.style.display = 'none'; if (voiceBtn) voiceBtn.classList.remove('recording'); stopRecordingTimer(); }

function startRecordingTimer() {
  stopRecordingTimer();
  recordingTimerInterval = setInterval(function() {
    var elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    recordingTimer.textContent = Math.floor(elapsed / 60) + ':' + String(elapsed % 60).padStart(2, '0');
    if (elapsed >= 60) stopRecording();
  }, 200);
}
function stopRecordingTimer() {
  if (recordingTimerInterval) { clearInterval(recordingTimerInterval); recordingTimerInterval = null; }
  recordingTimer.textContent = '0:00';
}

async function sendVoiceMessage(chunks, duration) {
  var blob = new Blob(chunks, { type: mediaRecorder ? mediaRecorder.mimeType : 'audio/webm' });
  if (blob.size < 100) return;
  if (blob.size > 2 * 1024 * 1024) { showToast('语音消息不能超过 2MB', 2000, 'error'); return; }
  try {
    var uploadResult = await Api.uploadFile(new File([blob], 'voice.webm', { type: blob.type }));
    var msg = await Api.sendMessage(activeChat, uploadResult.url || uploadResult.dataUrl || '', 2);
    var chatId = activeChat.startsWith('g_') ? activeChat : getChatId(currentUser.id, activeChat);
    if (!messageCache.has(chatId)) messageCache.set(chatId, []);
    messageCache.get(chatId).push(msg);
    renderMessages(); scrollToBottom(); renderChatList();
  } catch (e) {
    showToast(e.message || '语音发送失败', 2000, 'error');
  }
}

voiceBtn.addEventListener('mousedown', function(e) {
  e.preventDefault();
  if (isRecording) return;
  isVoicePressed = true;
  voicePressTimer = setTimeout(function() { if (isVoicePressed) startRecording(); }, 200);
});
document.addEventListener('mouseup', function() {
  if (isVoicePressed) {
    isVoicePressed = false;
    if (voicePressTimer) { clearTimeout(voicePressTimer); voicePressTimer = null; }
    if (isRecording) stopRecording();
  }
});
voiceBtn.addEventListener('touchstart', function(e) {
  if (isRecording) return;
  isVoicePressed = true;
  voicePressTimer = setTimeout(function() { if (isVoicePressed) startRecording(); }, 200);
}, { passive: true });
document.addEventListener('touchend', function(e) {
  if (isVoicePressed) {
    isVoicePressed = false;
    if (voicePressTimer) { clearTimeout(voicePressTimer); voicePressTimer = null; }
    if (isRecording) stopRecording();
  }
});
voiceBtn.addEventListener('touchstart', function(e) { voiceCancelY = e.touches[0].clientY; }, { passive: true });
document.addEventListener('touchmove', function(e) {
  if (isRecording && e.touches[0].clientY < voiceCancelY - 80) { cancelRecording(); showToast('已取消', 1000); }
}, { passive: true });

// ═══════════════════════════════════════════════════════════════
// 语音消息 — 播放
// ═══════════════════════════════════════════════════════════════
function toggleVoicePlay(voiceEl) {
  if (!voiceEl || !voicePlayer) return;
  var url = voiceEl.dataset.url;
  var msgId = voiceEl.dataset.msgId;
  if (currentPlayingVoice === msgId && !voicePlayer.paused) {
    voicePlayer.pause();
    voiceEl.dataset.playing = 'false';
    var icon = voiceEl.querySelector('.voice-play-icon');
    if (icon) icon.classList.replace('bi-pause-fill', 'bi-play-fill');
    clearInterval(voicePlayInterval);
    return;
  }
  if (currentPlayingVoice) {
    var prev = document.querySelector('.voice-bubble[data-msg-id="' + currentPlayingVoice + '"]');
    if (prev) {
      prev.dataset.playing = 'false';
      var icon = prev.querySelector('.voice-play-icon');
      if (icon) icon.classList.replace('bi-pause-fill', 'bi-play-fill');
    }
  }
  clearInterval(voicePlayInterval);
  voicePlayer.src = url;
  voicePlayer.play().then(function() {
    voicePlayer.playbackRate = 1;
    currentPlayingVoice = msgId;
    voiceEl.dataset.playing = 'true';
    var icon = voiceEl.querySelector('.voice-play-icon');
    if (icon) icon.classList.replace('bi-play-fill', 'bi-pause-fill');
    voicePlayInterval = setInterval(function() {
      if (voicePlayer.ended || voicePlayer.paused) {
        clearInterval(voicePlayInterval);
        voiceEl.dataset.playing = 'false';
        var icon = voiceEl.querySelector('.voice-play-icon');
        if (icon) icon.classList.replace('bi-pause-fill', 'bi-play-fill');
        currentPlayingVoice = null;
      }
    }, 200);
  }).catch(function() { showToast('音频加载失败', 1500, 'error'); });
}

document.addEventListener('click', function(e) {
  var voiceBubble = e.target.closest('.voice-bubble');
  if (voiceBubble) {
    var dot = voiceBubble.querySelector('.voice-unread-dot');
    if (dot) dot.style.display = 'none';
    toggleVoicePlay(voiceBubble);
  }
});

window.addEventListener('beforeunload', function() {
  if (voicePlayer) voicePlayer.pause();
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
});

// ─── Image preview ─────────────────────────────────────────
function showImagePreview(src) {
  var overlay = document.createElement('div');
  overlay.className = 'img-preview-overlay';
  overlay.innerHTML = '<img src="' + src + '" alt=""><button class="img-preview-close" id="imgPreviewClose"><i class="bi bi-x-lg"></i></button>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay || e.target.closest('.img-preview-close')) {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity .2s';
      setTimeout(function() { overlay.remove(); }, 200);
    }
  });
}
window.showImagePreview = showImagePreview;

// ─── Call buttons ─────────────────────────────────────────
chatVoiceCallBtn.addEventListener('click', function() {
  if (!activeChat || activeChat.startsWith('g_')) { showToast('暂不支持群聊通话', 1500, 'warning'); return; }
  if (typeof window.WeTalkCall !== 'undefined' && typeof window.WeTalkCall.voiceCall === 'function') { window.WeTalkCall.voiceCall(activeChat); }
  else { showToast('通话模块加载中，请稍后再试', 2000, 'warning'); }
});

chatVideoCallBtn.addEventListener('click', function() {
  if (!activeChat || activeChat.startsWith('g_')) { showToast('暂不支持群聊通话', 1500, 'warning'); return; }
  if (typeof window.WeTalkCall !== 'undefined' && typeof window.WeTalkCall.videoCall === 'function') { window.WeTalkCall.videoCall(activeChat); }
  else { showToast('通话模块加载中，请稍后再试', 2000, 'warning'); }
});

// ─── Message search ────────────────────────────────────────
chatSearchBtn.addEventListener('click', function() {
  if (!activeChat) { showToast('请先打开一个聊天', 1500, 'warning'); return; }
  msgSearchBar.style.display = 'flex';
  msgSearchInput.value = ''; msgSearchInput.focus();
  msgSearchCount.textContent = '';
  msgSearchResults = []; msgSearchIndex = -1;
  clearSearchHighlights();
});

msgSearchClose.addEventListener('click', function() { msgSearchBar.style.display = 'none'; clearSearchHighlights(); });

msgSearchInput.addEventListener('input', function() {
  var q = msgSearchInput.value.trim().toLowerCase();
  if (!q) { msgSearchCount.textContent = ''; clearSearchHighlights(); return; }
  var chatId = activeChat.startsWith('g_') ? activeChat : getChatId(currentUser.id, activeChat);
  var msgs = messageCache.get(chatId) || [];
  msgSearchResults = [];
  msgs.forEach(function(m, i) { if (m.text && m.text.toLowerCase().indexOf(q) >= 0 && m.type !== 'recalled') msgSearchResults.push({ index: i, msg: m }); });
  msgSearchIndex = msgSearchResults.length > 0 ? 0 : -1;
  highlightSearchResults(q);
});

msgSearchUp.addEventListener('click', function() {
  if (msgSearchResults.length === 0) return;
  msgSearchIndex = (msgSearchIndex - 1 + msgSearchResults.length) % msgSearchResults.length;
  scrollToSearchResult();
});

msgSearchDown.addEventListener('click', function() {
  if (msgSearchResults.length === 0) return;
  msgSearchIndex = (msgSearchIndex + 1) % msgSearchResults.length;
  scrollToSearchResult();
});

function clearSearchHighlights() {
  messagesContainer.querySelectorAll('.msg-search-highlight, .msg-search-current').forEach(function(el) { el.classList.remove('msg-search-highlight', 'msg-search-current'); });
}

function highlightSearchResults(q) {
  clearSearchHighlights();
  msgSearchResults.forEach(function(r, idx) {
    var row = messagesContainer.querySelector('[data-msg-id="' + r.msg.id + '"]');
    if (row) {
      var bubble = row.querySelector('.message-bubble');
      if (bubble) {
        bubble.classList.add('msg-search-highlight');
        if (idx === msgSearchIndex) bubble.classList.add('msg-search-current');
      }
    }
  });
  msgSearchCount.textContent = msgSearchResults.length === 0 ? '无结果' : (msgSearchIndex + 1) + '/' + msgSearchResults.length;
  scrollToSearchResult();
}

function scrollToSearchResult() {
  if (msgSearchIndex < 0 || msgSearchIndex >= msgSearchResults.length) return;
  var r = msgSearchResults[msgSearchIndex];
  var row = messagesContainer.querySelector('[data-msg-id="' + r.msg.id + '"]');
  if (row) {
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    messagesContainer.querySelectorAll('.msg-search-current').forEach(function(el) { el.classList.remove('msg-search-current'); });
    var bubble = row.querySelector('.message-bubble');
    if (bubble) bubble.classList.add('msg-search-current');
    msgSearchCount.textContent = (msgSearchIndex + 1) + '/' + msgSearchResults.length;
  }
}

// ─── Selection mode ────────────────────────────────────────
selectionCancel.addEventListener('click', exitSelectionMode);
selectionDelete.addEventListener('click', function() {
  if (selectedMsgIds.size === 0) return;
  if (!confirm('确定删除选中的 ' + selectedMsgIds.size + ' 条消息？')) return;
  var chatId = activeChat.startsWith('g_') ? activeChat : getChatId(currentUser.id, activeChat);
  var msgs = messageCache.get(chatId);
  if (!msgs) return;
  selectedMsgIds.forEach(function(id) {
    var idx = msgs.findIndex(function(m) { return m.id === id; });
    if (idx > -1) msgs.splice(idx, 1);
  });
  exitSelectionMode(); renderMessages(); showToast('已删除', 1500, 'success');
});

selectionForward.addEventListener('click', function() {
  if (selectedMsgIds.size === 0) return;
  var chatId = activeChat.startsWith('g_') ? activeChat : getChatId(currentUser.id, activeChat);
  var msgs = messageCache.get(chatId) || [];
  var firstMsg = msgs.find(function(m) { return m.id === Array.from(selectedMsgIds)[0]; });
  if (firstMsg) {
    ctxMsgId = firstMsg.id; ctxMsgChatId = chatId;
    exitSelectionMode();
    showBsModal(document.getElementById('forwardModal'));
    renderForwardList(myFriends);
    document.getElementById('fwSearch').value = ''; document.getElementById('fwSearch').focus();
  }
});

function enterSelectionMode() {
  selectedMsgIds.clear();
  selectionToolbar.style.display = 'flex';
  selectionCount.textContent = '已选 0 条';
  document.querySelectorAll('.message-row').forEach(function(row) {
    row.classList.add('selectable');
    row.addEventListener('click', handleMessageSelect);
  });
}

function exitSelectionMode() {
  selectedMsgIds.clear();
  selectionToolbar.style.display = 'none';
  document.querySelectorAll('.message-row').forEach(function(row) {
    row.classList.remove('selectable', 'selected');
    row.removeEventListener('click', handleMessageSelect);
  });
}

function handleMessageSelect(e) {
  var row = e.currentTarget;
  var msgId = row.dataset.msgId;
  if (!msgId) return;
  if (selectedMsgIds.has(msgId)) { selectedMsgIds.delete(msgId); row.classList.remove('selected'); }
  else { selectedMsgIds.add(msgId); row.classList.add('selected'); }
  selectionCount.textContent = '已选 ' + selectedMsgIds.size + ' 条';
}

// ─── Loading skeleton ──────────────────────────────────────
function showMessageLoading() {
  msgLoadingSkeleton.style.display = 'flex';
  messagesContainer.querySelectorAll('.message-row, .date-divider, .load-more').forEach(function(el) { el.style.display = 'none'; });
}
function hideMessageLoading() {
  msgLoadingSkeleton.style.display = 'none';
  messagesContainer.querySelectorAll('.message-row, .date-divider, .load-more').forEach(function(el) { el.style.display = ''; });
}

// ─── Smart time display ────────────────────────────────────
function formatTimeSmart(ts, prevTs) {
  var d = new Date(ts);
  var now = new Date();
  var pad = function(n) { return String(n).padStart(2, '0'); };
  var hhmm = pad(d.getHours()) + ':' + pad(d.getMinutes());
  if (prevTs && (ts - prevTs) < 180000) return '<span class="message-time-smart hidden-time">' + hhmm + '</span>';
  if (d.toDateString() === now.toDateString()) return '<span class="message-time-smart">' + hhmm + '</span>';
  var y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return '<span class="message-time-smart">昨天 ' + hhmm + '</span>';
  return '<span class="message-time-smart">' + pad(d.getMonth()+1) + '/' + pad(d.getDate()) + ' ' + hhmm + '</span>';
}

// ─── Context menu ─────────────────────────────────────────
document.addEventListener('contextmenu', function(e) {
  var bubble = e.target.closest('.message-bubble, .rp-bubble');
  if (!bubble) { document.getElementById('contextMenu').style.display = 'none'; return; }
  e.preventDefault();
  var row = bubble.closest('.message-row');
  ctxMsgId = row ? row.dataset.msgId : null;
  ctxMsgChatId = row ? row.dataset.chatId : null;
  if (!ctxMsgId) return;
  var menu = document.getElementById('contextMenu');
  menu.style.left = Math.min(e.clientX, window.innerWidth - 140) + 'px';
  menu.style.top = Math.min(e.clientY, window.innerHeight - 200) + 'px';
  menu.style.display = 'block';
  document.getElementById('ctxDelete').style.display = row && row.classList.contains('mine') ? 'block' : 'none';
});
document.addEventListener('click', function() { document.getElementById('contextMenu').style.display = 'none'; });

document.getElementById('ctxReply').onclick = function() {
  var msgs = messageCache.get(ctxMsgChatId) || [];
  var msg = msgs.find(function(m) { return m.id === ctxMsgId; });
  if (msg) { replyToMsg = msg; showQuoteBar(msg); }
};
document.getElementById('ctxForward').onclick = function() {
  showBsModal(document.getElementById('forwardModal'));
  renderForwardList(myFriends);
  document.getElementById('fwSearch').value = '';
  document.getElementById('fwSearch').focus();
};
document.getElementById('ctxFavorite').onclick = function() { showToast('收藏功能开发中'); };
document.getElementById('ctxCopy').onclick = function() {
  var msgs = messageCache.get(ctxMsgChatId) || [];
  var msg = msgs.find(function(m) { return m.id === ctxMsgId; });
  if (msg && msg.text) navigator.clipboard.writeText(msg.text).then(function() { showToast('已复制'); });
};
document.getElementById('ctxDelete').onclick = function() {
  if (!confirm('删除此消息？')) return;
  var msgs = messageCache.get(ctxMsgChatId);
  if (!msgs) return;
  var idx = msgs.findIndex(function(m) { return m.id === ctxMsgId; });
  if (idx > -1) msgs.splice(idx, 1);
  renderMessages();
};

function showQuoteBar(msg) {
  var bar = document.getElementById('quoteBar');
  if (bar) bar.remove();
  bar = document.createElement('div');
  bar.id = 'quoteBar';
  bar.style.cssText = 'display:flex;align-items:center;padding:.3rem .6rem;background:#e8f5e9;border-left:3px solid var(--green);font-size:.78rem;color:#555;gap:.5rem;flex-shrink:0';
  bar.innerHTML = '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">回复：' + escapeHtml((msg.text||'').slice(0, 40)) + '</span><span id="cancelReply" style="cursor:pointer;font-size:1rem;opacity:.5">✕</span>';
  document.querySelector('.input-area').before(bar);
  document.getElementById('cancelReply').onclick = function() { bar.remove(); replyToMsg = null; };
}

// Override sendMessage to support reply
sendMessage = async function() {
  var text = messageInput.value.trim();
  if (!text || !activeChat) return;
  var replyText = replyToMsg ? '「' + (replyToMsg.text||'').slice(0, 20) + '」\n' : '';
  try {
    var msg = await Api.sendMessage(activeChat, replyText + text, 1);
    var chatId = activeChat.startsWith('g_') ? activeChat : getChatId(currentUser.id, activeChat);
    if (!messageCache.has(chatId)) messageCache.set(chatId, []);
    messageCache.get(chatId).push(msg);
    renderMessages(); scrollToBottom(); renderChatList();
  } catch (e) { showToast(e.message || '发送失败', 2000, 'error'); }
  messageInput.value = ''; emojiPanel.style.display = 'none'; updateSendBtn();
  var qb = document.getElementById('quoteBar'); if (qb) qb.remove(); replyToMsg = null;
};

document.getElementById('fwModalOverlay').onclick = document.getElementById('fwModalClose').onclick = function() { hideBsModal(document.getElementById('forwardModal')); };
document.getElementById('fwSearch').addEventListener('input', function() {
  var q = document.getElementById('fwSearch').value.trim().toLowerCase();
  renderForwardList(myFriends.filter(function(f) { return f.name.toLowerCase().indexOf(q) >= 0; }));
});

function renderForwardList(list) {
  var el = document.getElementById('fwContactList');
  if (!list || !list.length) { el.innerHTML = '<p style="text-align:center;padding:.5rem;color:#888;font-size:.78rem">无好友</p>'; return; }
  el.innerHTML = list.map(function(f) {
    var aHtml = f.avatar ? '<img src="' + f.avatar + '">' : (f.avatarChar || '?');
    var aBg = f.avatar ? '' : (f.avatarColor || '#666');
    return '<div class="search-result-item" onclick="doForward(\'' + f.id + '\')"><div class="avatar" style="width:34px;height:34px;background:' + aBg + ';font-size:.7rem">' + aHtml + '</div><span style="font-size:.82rem">' + escapeHtml(f.name) + '</span></div>';
  }).join('');
}

async function doForward(toId) {
  if (!ctxMsgId) return;
  var chatId = ctxMsgChatId;
  var msgs = messageCache.get(chatId) || [];
  var msg = msgs.find(function(m) { return m.id === ctxMsgId; });
  if (msg) {
    try {
      await Api.sendMessage(toId, msg.text || '', 1);
      showToast('已转发');
      hideBsModal(document.getElementById('forwardModal'));
    } catch (e) { showToast(e.message || '转发失败'); }
  }
}
window.doForward = doForward;

function loadFavorites() {
  document.getElementById('favoritesList').innerHTML = '<p style="text-align:center;padding:1rem;color:#888;font-size:.78rem">收藏功能开发中</p>';
}
window.deleteFav = function(id) { showToast('收藏功能开发中'); };
document.getElementById('favBackBtn').onclick = function() {
  document.getElementById('favoritesPage').classList.remove('active');
  var tab = document.querySelector('[data-tab="profile"]');
  if (tab) tab.click();
};

// ─── 修改密码 ─────────────────────────────────────────────
document.getElementById('cpModalOverlay').onclick = document.getElementById('cpModalClose').onclick = function() { hideBsModal(document.getElementById('changePwdModal')); };
document.getElementById('cpSaveBtn').addEventListener('click', async function() {
  var o = document.getElementById('cpOldPwd').value;
  var n = document.getElementById('cpNewPwd').value;
  var c = document.getElementById('cpConfirmPwd').value;
  var err = document.getElementById('cpError');
  if (!o) { err.textContent = '请输入原密码'; return; }
  if (!n || n.length < 8 || n.length > 64) { err.textContent = '新密码需8-64位'; return; }
  if (!/[a-zA-Z]/.test(n)) { err.textContent = '新密码需包含字母'; return; }
  if (n !== c) { err.textContent = '两次密码不一致'; return; }
  err.textContent = '';
  try {
    await Api.updateProfile({ oldPassword: o, newPassword: n });
    showToast('密码已修改');
    hideBsModal(document.getElementById('changePwdModal'));
    document.getElementById('cpOldPwd').value = ''; document.getElementById('cpNewPwd').value = ''; document.getElementById('cpConfirmPwd').value = '';
  } catch (e) { err.textContent = e.message || '修改失败'; }
});

// ═══════════════════════════════════════════════════════════════
// 打字状态 / @提醒
// ═══════════════════════════════════════════════════════════════
messageInput.addEventListener('input', function() {
  if (!activeChat) return;
  if (activeChat.startsWith('g_')) {
    var val = messageInput.value;
    var ai = val.lastIndexOf('@');
    if (ai >= 0 && (ai === 0 || val[ai-1] === ' ')) {
      var q = val.slice(ai+1).toLowerCase();
      if (!q.indexOf(' ') < 0 && !atMenuDiv) {
        Api.getGroupInfo(activeChat).then(function(res) {
          atMenuDiv = document.createElement('div');
          atMenuDiv.className = 'at-menu';
          atMenuDiv.innerHTML = (res.memberDetails||[]).filter(function(m) { return (m.user && m.user.name && m.user.name.toLowerCase().indexOf(q) >= 0); }).map(function(m) {
            var ah = (m.user && m.user.avatarChar) || '?';
            var ab = (m.user && m.user.avatarColor) || '#666';
            return '<div class="at-item" onclick="selectAt(\'' + escapeHtml(m.user ? m.user.name : m.userId) + '\')"><span class="at-avatar" style="background:' + ab + '">' + ah + '</span>@' + escapeHtml(m.user ? m.user.name : m.userId) + '</div>';
          }).join('');
          var inputArea = document.querySelector('.input-area');
          if (inputArea) inputArea.appendChild(atMenuDiv);
        }).catch(function() {});
      } else if (q.indexOf(' ') >= 0) { if (atMenuDiv) { atMenuDiv.remove(); atMenuDiv = null; } }
    } else { if (atMenuDiv) { atMenuDiv.remove(); atMenuDiv = null; } }
  }
});

function selectAt(n) {
  var val = messageInput.value;
  var idx = val.lastIndexOf('@');
  messageInput.value = val.slice(0, idx) + '@' + n + ' ';
  if (atMenuDiv) { atMenuDiv.remove(); atMenuDiv = null; }
  messageInput.focus();
}
window.selectAt = selectAt;

// ═══════════════════════════════════════════════════════════════
// 手机返回
// ═══════════════════════════════════════════════════════════════
mobileBack.addEventListener('click', function() {
  document.getElementById('sidebar').classList.remove('with-chat');
  document.querySelector('.chat-area').classList.remove('with-chat');
});

// ═══════════════════════════════════════════════════════════════
// 聊天操作
// ═══════════════════════════════════════════════════════════════
function getLocalChatSettings(chatId) { return _chatSettingsCache ? (_chatSettingsCache.get(chatId) || {}) : {}; }
function togglePin(userId) { showToast('置顶操作开发中'); }
window.togglePin = togglePin;
function toggleMute(userId) { showToast('免打扰操作开发中'); }
window.toggleMute = toggleMute;
function deleteChat(userId) {
  if (!confirm('确定删除此聊天？')) return;
  var chatId = userId.startsWith('g_') ? userId : getChatId(currentUser.id, userId);
  messageCache.delete(chatId);
  if (activeChat === userId) { activeChat = null; chatWindow.style.display = 'none'; emptyState.style.display = 'flex'; }
  renderChatList(); showToast('已删除');
}
window.deleteChat = deleteChat;

// ═══════════════════════════════════════════════════════════════
// 签到
// ═══════════════════════════════════════════════════════════════
function doCheckIn() { showToast('签到功能开发中'); }
window.doCheckIn = doCheckIn;

document.getElementById('ppFavRow').addEventListener('click', function() {
  document.querySelectorAll('.tab-content').forEach(function(t) { t.classList.remove('active'); });
  document.getElementById('favoritesPage').classList.add('active');
  loadFavorites();
});
document.getElementById('ppPwdRow').addEventListener('click', function() {
  showBsModal(document.getElementById('changePwdModal'));
  document.getElementById('cpOldPwd').value = ''; document.getElementById('cpNewPwd').value = ''; document.getElementById('cpConfirmPwd').value = ''; document.getElementById('cpError').textContent = '';
});

// ═══════════════════════════════════════════════════════════════
// 个人资料 UI
// ═══════════════════════════════════════════════════════════════
function updateProfileUI() {
  if (!currentUser) return;
  var u = currentUser;
  var sidebarBadge = profileAvatar.querySelector('.profile-avatar-badge');
  var sidebarImg = profileAvatar.querySelector('img');
  if (u.avatar) {
    profileAvatarChar.style.display = 'none';
    if (!sidebarImg) { sidebarImg = document.createElement('img'); sidebarImg.alt = ''; profileAvatar.insertBefore(sidebarImg, sidebarBadge); }
    sidebarImg.src = u.avatar;
    profileAvatar.style.background = 'transparent';
  } else {
    profileAvatarChar.style.display = '';
    if (sidebarImg) sidebarImg.remove();
    profileAvatarChar.textContent = u.avatarChar || 'U';
    profileAvatar.style.background = u.avatarColor || '#1aad19';
  }
  profileName.textContent = u.name;

  var ppImg = ppAvatar.querySelector('img');
  var ppOverlayHtml = '<div class="pp-avatar-overlay"><i class="bi bi-camera" style="color:#fff;font-size:1.4rem"></i></div>';
  if (u.avatar) {
    ppAvatarChar.style.display = 'none';
    var oldOv = ppAvatar.querySelector('.pp-avatar-overlay'); if (oldOv) oldOv.remove();
    if (!ppImg) { ppImg = document.createElement('img'); ppImg.alt = ''; ppAvatar.appendChild(ppImg); }
    ppImg.src = u.avatar;
    ppAvatar.insertAdjacentHTML('beforeend', ppOverlayHtml);
    ppAvatar.style.background = 'transparent';
  } else {
    ppAvatarChar.style.display = '';
    var oldOv = ppAvatar.querySelector('.pp-avatar-overlay'); if (oldOv) oldOv.remove();
    if (ppImg) ppImg.remove();
    ppAvatarChar.textContent = u.avatarChar || 'U';
    ppAvatar.style.background = u.avatarColor || '#1aad19';
  }
  ppName.textContent = u.name;
  ppPhone.textContent = u.phone ? u.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '未绑定';

  if (u.realNameVerified) { ppRealNameStatus.innerHTML = '<span class="realname-badge verified">已认证 · ' + escapeHtml(u.realName || '') + '</span>'; }
  else if (u.verificationStatus === 'pending') { ppRealNameStatus.innerHTML = '<span class="realname-badge pending">⏳ 审核中</span>'; }
  else { ppRealNameStatus.innerHTML = '<span class="realname-badge unverified">未认证</span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#999" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>'; }

  ppBalance.textContent = '¥' + (u.balance || 0).toFixed(2);
  var genderEl = document.getElementById('ppGender');
  if (genderEl) genderEl.textContent = u.gender === 'male' ? '男' : u.gender === 'female' ? '女' : '未设置';
  var pointsEl = document.getElementById('ppPoints');
  if (pointsEl) pointsEl.textContent = (u.points || 0) + ' 分';
}

// ═══════════════════════════════════════════════════════════════
// 头像上传
// ═══════════════════════════════════════════════════════════════
ppChangeAvatar.addEventListener('click', function() { avatarInput.click(); });
ppAvatar.addEventListener('click', function() { avatarInput.click(); });

avatarInput.addEventListener('change', async function(e) {
  var file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('图片不能超过 2MB'); return; }
  try {
    var uploadResult = await Api.uploadFile(file);
    await Api.updateProfile({ avatar: uploadResult.url });
    currentUser.avatar = uploadResult.url;
    updateProfileUI(); renderContactList(); renderChatList();
    if (activeChat) updateChatHeader(activeChat);
    showToast('头像已更新');
  } catch (e) { showToast(e.message || '上传失败'); }
});

// ═══════════════════════════════════════════════════════════════
// 编辑昵称
// ═══════════════════════════════════════════════════════════════
ppEditName.addEventListener('click', function() {
  nameEditInput.value = currentUser.name;
  showBsModal(nameEditModal);
  nameEditInput.focus();
});
nameModalOverlay.onclick = nameModalClose.onclick = function() { hideBsModal(nameEditModal); };
nameSaveBtn.addEventListener('click', async function() {
  var name = nameEditInput.value.trim();
  if (!name) { showToast('昵称不能为空'); return; }
  try {
    var user = await Api.updateProfile({ nickname: name });
    currentUser = user;
    updateProfileUI(); renderContactList(); renderChatList();
    if (activeChat) updateChatHeader(activeChat);
    hideBsModal(nameEditModal);
    showToast('昵称已更新');
  } catch (e) { showToast(e.message || '修改失败'); }
});

// ═══════════════════════════════════════════════════════════════
// 实名认证
// ═══════════════════════════════════════════════════════════════
ppRealNameRow.addEventListener('click', function() {
  if (currentUser.realNameVerified) { showToast('已完成实名认证'); return; }
  showBsModal(realnameModal);
});
realnameOverlay.onclick = realnameClose.onclick = function() { hideBsModal(realnameModal); };
realnameSubmitBtn.addEventListener('click', async function() {
  var realName = realnameInput.value.trim();
  var idCard = idcardInput.value.trim();
  if (!realName || realName.length < 2) { showToast('请输入真实姓名'); return; }
  if (!/^\d{17}[\dXx]$/.test(idCard)) { showToast('身份证号格式不正确'); return; }
  try {
    var user = await Api.updateProfile({ realName: realName, idCard: idCard });
    currentUser = user;
    updateProfileUI(); renderContactList(); renderChatList();
    hideBsModal(realnameModal);
    showToast('已提交认证，等待管理员审核');
  } catch (e) { showToast(e.message || '认证失败'); }
});

// ═══════════════════════════════════════════════════════════════
// 红包
// ═══════════════════════════════════════════════════════════════
redpacketBtn.addEventListener('click', function() {
  if (!activeChat) { showToast('请先选择一个聊天'); return; }
  var user = contacts.get(activeChat);
  if (!user) return;
  rpTo.textContent = '发给：' + escapeHtml(user.name);
  rpAmount.value = ''; rpBlessing.value = '';
  document.querySelectorAll('.rp-fast').forEach(function(b) { b.classList.remove('selected'); });
  redpacketModal.style.display = 'flex';
  rpAmount.focus();
});

rpModalOverlay.onclick = rpClose.onclick = function() { redpacketModal.style.display = 'none'; };

rpFastBtns.forEach(function(btn) {
  btn.addEventListener('click', function() {
    rpFastBtns.forEach(function(b) { b.classList.remove('selected'); });
    btn.classList.add('selected');
    rpAmount.value = btn.dataset.amt;
  });
});

rpSendBtn.addEventListener('click', async function() {
  if (!currentUser.realNameVerified) {
    redpacketModal.style.display = 'none';
    if (currentUser.verificationStatus === 'pending') { showToast('实名认证正在审核中，请等待管理员通过'); }
    else { showToast('使用红包功能需先实名认证'); }
    showBsModal(realnameModal);
    return;
  }
  var amount = parseFloat(rpAmount.value);
  var blessing = rpBlessing.value.trim() || '恭喜发财，大吉大利';
  if (isNaN(amount) || amount <= 0) { showToast('请输入有效金额'); rpAmount.focus(); return; }
  if (amount > 200) { showToast('单个红包金额上限 200 元'); return; }
  if (amount < 0.01) { showToast('金额不能低于 0.01 元'); return; }

  rpSendBtn.disabled = true;
  rpSendBtn.textContent = '发送中...';
  try {
    var msg = await Api.sendMessage(activeChat, blessing + '|红包:' + amount.toFixed(2), 5);
    redpacketModal.style.display = 'none';
    var chatId = getChatId(currentUser.id, activeChat);
    if (!messageCache.has(chatId)) messageCache.set(chatId, []);
    messageCache.get(chatId).push(msg);
    renderMessages(); scrollToBottom(); renderChatList();
    showToast('红包已发送');
  } catch (e) {
    showToast(e.message || '发送失败');
  }
  rpSendBtn.disabled = false;
  rpSendBtn.textContent = '塞进红包';
});

// 打开红包
function handleRedpacketClick(msg) {
  var isMine = msg.from === currentUser.id;
  if (isMine) { showToast(msg.redpacket && msg.redpacket.opened ? '红包已被领取' : '等待对方领取'); return; }
  if (msg.redpacket && msg.redpacket.opened) { showToast('红包已被领取'); return; }

  currentRpMessage = msg;
  rpOpenUnopened.style.display = 'flex';
  rpOpenResult.style.display = 'none';
  var sender = contacts.get(msg.from);
  rpOpenSender.textContent = sender ? sender.name : '用户';
  rpOpenBlessing.textContent = msg.text || '恭喜发财，大吉大利';
  openRpOverlay.style.display = 'flex';
}

rpOpenBtn.addEventListener('click', async function() {
  if (!currentRpMessage) return;
  var msg = currentRpMessage;
  try {
    var packetId = (msg.redpacket && msg.redpacket.packetId) || '';
    var res = await Api.sendMessage(msg.from, '_open_redpacket:' + packetId, 6);
    msg.redpacket.opened = true;
    msg.redpacket.openedAt = Date.now();
    if (res && res.balance !== undefined) currentUser.balance = res.balance;

    rpOpenUnopened.style.display = 'none';
    rpOpenResult.style.display = 'flex';
    rpResultAmount.textContent = '¥' + (res && res.amount ? res.amount.toFixed(2) : '0.00');
    rpResultFrom.textContent = '来自 ' + escapeHtml(res && res.senderName ? res.senderName : '用户') + ' 的红包';

    renderMessages(); renderChatList(); updateProfileUI();
  } catch (e) {
    showToast(e.message || '领取失败');
    openRpOverlay.style.display = 'none';
  }
});

rpResultClose.addEventListener('click', function() { openRpOverlay.style.display = 'none'; currentRpMessage = null; });
rpOpenClose.addEventListener('click', function() { openRpOverlay.style.display = 'none'; currentRpMessage = null; });

// ═══════════════════════════════════════════════════════════════
// 撤回消息
// ═══════════════════════════════════════════════════════════════
async function recallMessage(messageId) {
  if (!confirm('撤回这条消息？')) return;
  try {
    await Api.recallMessage(messageId);
    var chatId = activeChat.startsWith('g_') ? activeChat : getChatId(currentUser.id, activeChat);
    var msgs = messageCache.get(chatId) || [];
    var msg = msgs.find(function(m) { return m.id === messageId; });
    if (msg) { msg.type = 'recalled'; msg.text = ''; }
    renderMessages(); renderChatList();
  } catch (e) { showToast(e.message || '撤回失败'); }
}
window.recallMessage = recallMessage;

// ═══════════════════════════════════════════════════════════════
// 侧栏头像点击
// ═══════════════════════════════════════════════════════════════
sidebarProfile.addEventListener('click', function() {
  tabs.forEach(function(t) { t.classList.remove('active'); });
  if (tabs[2]) tabs[2].classList.add('active');
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
  var d = new Date(ts);
  var now = new Date();
  var pad = function(n) { return String(n).padStart(2, '0'); };
  var hhmm = pad(d.getHours()) + ':' + pad(d.getMinutes());
  if (d.toDateString() === now.toDateString()) return hhmm;
  var y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return '昨天 ' + hhmm;
  return pad(d.getMonth()+1) + '/' + pad(d.getDate()) + ' ' + hhmm;
}

function formatDate(ts) {
  var d = new Date(ts);
  var now = new Date();
  var pad = function(n) { return String(n).padStart(2, '0'); };
  if (d.toDateString() === now.toDateString()) return '今天';
  var y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return '昨天';
  return d.getFullYear() + '年' + pad(d.getMonth()+1) + '月' + pad(d.getDate()) + '日';
}

// ═══════════════════════════════════════════════════════════════
// 消息回应 (Reactions)
// ═══════════════════════════════════════════════════════════════
var REACTION_EMOJIS = ['👍', '❤️', '😄', '😢', '😡'];

function createReactionPanel() {
  if (reactionPanel) return;
  reactionPanel = document.createElement('div');
  reactionPanel.id = 'reactionPanel';
  reactionPanel.className = 'reaction-panel';
  reactionPanel.style.display = 'none';
  document.body.appendChild(reactionPanel);
  REACTION_EMOJIS.forEach(function(emoji) {
    var btn = document.createElement('button');
    btn.className = 'reaction-btn';
    btn.textContent = emoji;
    btn.dataset.emoji = emoji;
    btn.addEventListener('click', function(e) { e.stopPropagation(); sendReaction(emoji); });
    reactionPanel.appendChild(btn);
  });
}

function showReactionPanel(msgId, targetEl) {
  reactionTargetMsgId = msgId;
  createReactionPanel();
  var rect = targetEl.getBoundingClientRect();
  var panelW = 240;
  var left = rect.left + rect.width / 2 - panelW / 2;
  if (left < 8) left = 8;
  if (left + panelW > window.innerWidth - 8) left = window.innerWidth - panelW - 8;
  reactionPanel.style.left = left + 'px';
  reactionPanel.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
  reactionPanel.style.display = 'flex';
}

function hideReactionPanel() { if (reactionPanel) reactionPanel.style.display = 'none'; }

async function sendReaction(emoji) {
  if (!reactionTargetMsgId || !activeChat) return;
  var chatId = activeChat.startsWith('g_') ? activeChat : getChatId(currentUser.id, activeChat);
  try {
    var res = await Api.sendMessage(activeChat, emoji, 101);
    var msgs2 = messageCache.get(chatId) || [];
    for (var i = 0; i < msgs2.length; i++) {
      if (msgs2[i].id === reactionTargetMsgId) {
        if (!msgs2[i].reactions) msgs2[i].reactions = [];
        var existingIdx = -1;
        for (var j = 0; j < msgs2[i].reactions.length; j++) {
          if (msgs2[i].reactions[j].emoji === emoji && msgs2[i].reactions[j].userId === currentUser.id) { existingIdx = j; break; }
        }
        if (existingIdx >= 0) { msgs2[i].reactions.splice(existingIdx, 1); }
        else { msgs2[i].reactions.push({ emoji: emoji, userId: currentUser.id }); }
        break;
      }
    }
    renderMessages();
  } catch (e) { /* silent */ }
  hideReactionPanel();
}

function renderReactions(reactions) {
  if (!reactions || reactions.length === 0) return '';
  var counts = {};
  var myId = currentUser ? currentUser.id : '';
  reactions.forEach(function(r) {
    if (!counts[r.emoji]) counts[r.emoji] = { count: 0, mine: false };
    counts[r.emoji].count++;
    if (r.userId === myId) counts[r.emoji].mine = true;
  });
  var html = '<div class="reactions-bar">';
  for (var emoji in counts) {
    var c = counts[emoji];
    html += '<span class="reaction-badge' + (c.mine ? ' mine' : '') + '" data-emoji="' + emoji + '">' + emoji + (c.count > 1 ? '<span class="reaction-count">' + c.count + '</span>' : '') + '</span>';
  }
  html += '</div>';
  return html;
}

// ─── 扫码 ────────────────────────────────────────────────
var scanQrBtn = $('scanQrBtn');
if (scanQrBtn) {
  scanQrBtn.addEventListener('click', async function() {
    if (NativeBridge.isApp) {
      try {
        var Camera2 = Capacitor.Plugins.Camera;
        showToast('请对准二维码拍照', 2000);
        var photo = await Camera2.getPhoto({ quality: 50, resultType: 'DATA_URL', source: 'CAMERA', correctOrientation: true });
        if (photo && photo.dataUrl) showToast('扫码功能需要安装扫码插件', 2000);
      } catch (e) { console.warn('[QR]', e.message); }
    } else { showToast('扫码仅支持手机 App', 1500); }
  });
}

// ─── 显示我的二维码 ──────────────────────────────────────
var ppQrRow = $('ppQrRow');
if (ppQrRow) {
  ppQrRow.addEventListener('click', function() {
    if (!currentUser) return;
    var modal = document.createElement('div');
    modal.className = 'wt-modal';
    modal.innerHTML = '<div class="modal-overlay" onclick="this.parentNode.remove()"></div><div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border-radius:16px;padding:1.5rem;text-align:center;z-index:200;width:260px;box-shadow:0 8px 40px rgba(0,0,0,.15)"><div style="font-size:.9rem;font-weight:600;margin-bottom:.8rem">' + escapeHtml(currentUser.name || '用户') + '</div><img src="/api/user/qrcode/' + currentUser.id + '?t=' + Date.now() + '" style="width:180px;height:180px;border-radius:8px" alt="二维码"><div style="font-size:.7rem;color:#999;margin-top:.5rem">扫一扫二维码，加我好友</div></div>';
    document.body.appendChild(modal);
  });
}

// ─── 手势返回（移动端右滑关闭聊天窗口） ────────────────
(function() {
  if (window.innerWidth > 768) return;
  var touchStartX = 0;
  var touchCurrentX = 0;
  var isSwiping = false;
  var chatWin2 = $('chatWindow');
  var sidebar2 = $('sidebar');
  if (!chatWin2) return;
  chatWin2.addEventListener('touchstart', function(e) {
    if (chatWin2.style.display !== 'flex' && getComputedStyle(chatWin2).display === 'none') return;
    if (e.touches[0].clientX > 40) return;
    touchStartX = e.touches[0].clientX; touchCurrentX = touchStartX; isSwiping = false;
  }, { passive: true });
  chatWin2.addEventListener('touchmove', function(e) {
    if (touchStartX === 0) return;
    touchCurrentX = e.touches[0].clientX;
    var deltaX = touchCurrentX - touchStartX;
    if (deltaX > 10) {
      isSwiping = true;
      var translateX = Math.min(deltaX, window.innerWidth * 0.6);
      chatWin2.style.transform = 'translateX(' + translateX + 'px)';
      chatWin2.style.transition = 'none';
      if (sidebar2) { sidebar2.style.opacity = Math.min(1, deltaX / 200); sidebar2.style.display = 'flex'; }
    }
  }, { passive: true });
  chatWin2.addEventListener('touchend', function() {
    if (!isSwiping) { touchStartX = 0; return; }
    var deltaX = touchCurrentX - touchStartX;
    var threshold = window.innerWidth * 0.3;
    if (deltaX > threshold) {
      chatWin2.style.transition = 'transform .25s ease-out';
      chatWin2.style.transform = 'translateX(100%)';
      setTimeout(function() {
        chatWin2.style.transform = ''; chatWin2.style.transition = '';
        var backBtn = $('mobileBack'); if (backBtn) backBtn.click();
        if (sidebar2) sidebar2.style.opacity = '';
      }, 250);
    } else {
      chatWin2.style.transition = 'transform .2s ease-out';
      chatWin2.style.transform = '';
      setTimeout(function() { chatWin2.style.transition = ''; if (sidebar2) sidebar2.style.opacity = ''; }, 200);
    }
    touchStartX = 0; isSwiping = false;
  }, { passive: true });
})();

function escapeHtml(text) {
  if (!text) return '';
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderMentions(text) {
  var escaped = escapeHtml(text || '');
  return escaped.replace(/@([^\s<]+)/g, '<span class="mention-highlight">@$1</span>');
}

function showNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body: body, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💚</text></svg>' });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// ─── PWA 推送通知订阅 ──────────────────────────────────────
async function subscribePushNotifications() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { console.log('[PWA] 推送通知不可用'); return; }
    if (!currentUser || !currentUser.id) { console.log('[PWA] 等待用户登录后订阅推送'); return; }
    if (Notification.permission !== 'granted') {
      var perm = await Notification.requestPermission();
      if (perm !== 'granted') return;
    }
    var registration = await navigator.serviceWorker.ready;
    var existing = await registration.pushManager.getSubscription();
    if (existing) {
      await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser.id, subscription: existing }) });
      return;
    }
    var keyResp = await fetch('/api/push/vapid-public-key');
    var keyData = await keyResp.json();
    if (!keyData.configured || !keyData.publicKey) { console.log('[PWA] 推送未配置'); return; }
    var subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(keyData.publicKey) });
    await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser.id, subscription: subscription }) });
    console.log('[PWA] 推送订阅成功');
  } catch (err) { console.warn('[PWA] 推送订阅失败:', err.message); }
}

function urlBase64ToUint8Array(base64String) {
  var padding = '='.repeat((4 - base64String.length % 4) % 4);
  var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var rawData = atob(base64);
  var output = new Uint8Array(rawData.length);
  for (var i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

// ─── 窗口自适应 ──────────────────────────────────────────
window.addEventListener('resize', function() {
  if (window.innerWidth > 768) {
    document.getElementById('sidebar').classList.remove('with-chat');
    document.querySelector('.chat-area').classList.remove('with-chat');
  }
});

// ─── 初始化发送按钮状态 ──────────────────────────────────
updateSendBtn();

// ─── Bootstrap: Tooltip + Modal 辅助 ─────────────────────
document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function(el) { new bootstrap.Tooltip(el); });
function showBsModal(el) { bootstrap.Modal.getOrCreateInstance(el).show(); }
function hideBsModal(el) { var m = bootstrap.Modal.getInstance(el); if (m) m.hide(); }

// ─── 首次使用引导 ────────────────────────────────────────
(function() {
  try {
    if (localStorage.getItem('wetalk_guide_shown')) return;
    var observer = new MutationObserver(function() {
      if (mainPage && mainPage.classList.contains('active') && !localStorage.getItem('wetalk_guide_shown')) {
        localStorage.setItem('wetalk_guide_shown', '1');
        setTimeout(function() { showToast('💬 点击联系人开始聊天', 3000); }, 1000);
        setTimeout(function() { showToast('🎤 长按麦克风发语音消息', 3000); }, 3500);
        setTimeout(function() { showToast('📞 顶栏可拨打语音/视频通话', 3000); }, 7000);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  } catch (e) { /* ignore */ }
})();

console.log('💚 WeTalk v3.0 (REST+SSE) 已加载');
