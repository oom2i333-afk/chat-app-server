// ═══════════════════════════════════════════════════════════════
// WeTalk - API Client v4.0 (REST + JWT)
// ═══════════════════════════════════════════════════════════════

const API_BASE = window.API_BASE || '/api/v1';

// ─── Token 管理 ──────────────────────────────────────────
const TokenManager = {
  _access: null,
  _refresh: null,

  init() {
    this._access = localStorage.getItem('wt_access');
    this._refresh = localStorage.getItem('wt_refresh');
  },

  getAccess() { return this._access; },

  setTokens(access, refresh) {
    this._access = access;
    this._refresh = refresh;
    localStorage.setItem('wt_access', access || '');
    localStorage.setItem('wt_refresh', refresh || '');
  },

  clear() {
    this._access = null;
    this._refresh = null;
    localStorage.removeItem('wt_access');
    localStorage.removeItem('wt_refresh');
  },

  isAuthenticated() { return !!this._access; }
};

// ─── HTTP 请求 ───────────────────────────────────────────
async function request(method, path, body = null) {
  const url = API_BASE + path;
  const headers = { 'Content-Type': 'application/json' };
  if (TokenManager.getAccess()) {
    headers['Authorization'] = 'Bearer ' + TokenManager.getAccess();
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  if (res.status === 401) {
    // Token expired, try refresh
    if (TokenManager._refresh) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        headers['Authorization'] = 'Bearer ' + TokenManager.getAccess();
        const retry = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
        const retryData = await retry.json();
        if (!retryData.success) throw new Error(retryData.error || '请求失败');
        return retryData.data;
      }
    }
    TokenManager.clear();
    throw new Error('登录已过期，请重新登录');
  }

  const data = await res.json();
  if (!data.success) throw new Error(data.error || '请求失败');
  return data.data;
}

async function tryRefresh() {
  try {
    const res = await fetch(API_BASE + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: TokenManager._refresh }),
    });
    const data = await res.json();
    if (data.success) {
      TokenManager.setTokens(data.data.accessToken, data.data.refreshToken);
      return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

// ─── API 方法 ────────────────────────────────────────────
const Api = {
  // Auth
  login(phone, password) {
    return request('POST', '/auth/login', { phone, password });
  },
  register(phone, password, captcha, captchaId, inviteCode) {
    return request('POST', '/auth/register', { phone, password, captcha, captchaId, inviteCode });
  },
  getCaptcha() {
    return request('POST', '/auth/captcha');
  },

  // Profile
  getProfile() {
    return request('GET', '/user/profile');
  },
  updateProfile(data) {
    return request('PUT', '/user/profile', data);
  },

  // Friends
  getFriends() {
    return request('GET', '/social/friends');
  },
  searchUsers(q) {
    return request('GET', '/social/friends/search?keyword=' + encodeURIComponent(q));
  },
  sendFriendRequest(toUid) {
    return request('POST', '/social/friend/request', { toUid });
  },
  acceptFriendRequest(fromUid) {
    return request('POST', '/social/friend/accept', { fromUid });
  },
  rejectFriendRequest(fromUid) {
    return request('POST', '/social/friend/reject', { fromUid });
  },
  getFriendRequests() {
    return request('GET', '/social/friend/requests');
  },
  deleteFriend(friendId) {
    return request('DELETE', '/social/friend/' + friendId);
  },

  // Groups
  getGroups() {
    return request('GET', '/social/groups');
  },
  getGroupInfo(groupId) {
    return request('GET', '/social/group/' + groupId);
  },
  getGroupMembers(groupId) {
    return request('GET', '/social/group/' + groupId + '/members');
  },
  createGroup(name, memberIds) {
    return request('POST', '/social/group/create', { name, memberIds });
  },
  leaveGroup(groupId) {
    return request('POST', '/social/group/' + groupId + '/leave');
  },
  dissolveGroup(groupId) {
    return request('POST', '/social/group/' + groupId + '/dissolve');
  },
  setGroupNotice(groupId, notice) {
    return request('PUT', '/social/group/' + groupId + '/notice', { notice });
  },
  setGroupRole(groupId, userId, role) {
    // Map role string to integer: 'member'=0, 'admin'=1, 'owner'=2
    var intRole = typeof role === 'string' ? ({ member: 0, admin: 1, owner: 2 })[role] || 0 : role;
    return request('POST', '/social/group/' + groupId + '/role', { userId, role: intRole });
  },
  addGroupMember(groupId, userId) {
    return request('POST', '/social/group/' + groupId + '/member', { userId });
  },
  muteGroupMember(groupId, userId, muted) {
    return request('POST', '/social/group/' + groupId + '/mute', { userId, muted: muted ? 1 : 0 });
  },

  // Messages
  getMessages(chatId, limit = 50, offset = 0) {
    return request('GET', '/message/history?chatId=' + encodeURIComponent(chatId) + '&limit=' + limit + '&offset=' + offset);
  },
  sendMessage(to, text, msgType = 1) {
    return request('POST', '/message/send', { to, text, msgType });
  },
  recallMessage(msgId) {
    return request('POST', '/message/recall', { msgId });
  },
  deleteMessage(msgId) {
    return request('DELETE', '/message/' + msgId);
  },

  // File
  uploadFile(file) {
    const url = API_BASE + '/file/upload';
    const formData = new FormData();
    formData.append('file', file);
    return fetch(url, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + TokenManager.getAccess() },
      body: formData,
    }).then(r => r.json()).then(d => { if (!d.success) throw new Error(d.error); return d.data; });
  },
};

// ─── SSE 客户端 ─────────────────────────────────────────
class SSEClient {
  constructor() {
    this.eventSource = null;
    this.listeners = {};
    this._reconnectTimer = null;
  }

  connect() {
    if (this.eventSource) this.disconnect();
    if (!TokenManager.getAccess()) return;

    this.eventSource = new EventSource(API_BASE + '/events?token=' + encodeURIComponent(TokenManager.getAccess()));

    this.eventSource.addEventListener('new-message', (e) => {
      try { this._emit('new-message', JSON.parse(e.data)); } catch (err) { /* ignore */ }
    });
    this.eventSource.addEventListener('message-status', (e) => {
      try { this._emit('message-status', JSON.parse(e.data)); } catch (err) { /* ignore */ }
    });
    this.eventSource.addEventListener('friend-online', (e) => {
      try { this._emit('user-online', JSON.parse(e.data)); } catch (err) { /* ignore */ }
    });
    this.eventSource.addEventListener('friend-offline', (e) => {
      try { this._emit('user-offline', JSON.parse(e.data)); } catch (err) { /* ignore */ }
    });
    this.eventSource.addEventListener('friend-request', (e) => {
      try { this._emit('new-friend-request', JSON.parse(e.data)); } catch (err) { /* ignore */ }
    });
    this.eventSource.addEventListener('friend-added', (e) => {
      try { this._emit('friend-added', JSON.parse(e.data)); } catch (err) { /* ignore */ }
    });
    this.eventSource.addEventListener('group-updated', (e) => {
      try { this._emit('group-updated', JSON.parse(e.data)); } catch (err) { /* ignore */ }
    });

    this.eventSource.onerror = () => {
      this.disconnect();
      this._reconnectTimer = setTimeout(() => this.connect(), 5000);
    };
  }

  disconnect() {
    if (this.eventSource) { this.eventSource.close(); this.eventSource = null; }
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
  }

  on(event, handler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  off(event, handler) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(h => h !== handler);
  }

  _emit(event, data) {
    (this.listeners[event] || []).forEach(h => h(data));
  }
}

// ─── 初始化 ──────────────────────────────────────────────
TokenManager.init();

// Export for use in app.js
window.TokenManager = TokenManager;
window.Api = Api;
window.SSEClient = SSEClient;
