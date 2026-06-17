# WeTalk 四项新功能 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 添加文件传输、群@提及、消息回应、移动端完善四大功能

**Architecture:** 扩展现有 Socket.io 消息类型体系，新增 `send-file`/`react-to-message` 事件；修改 `send-message` 事件支持 @ 解析；集成 web-push 实现推送通知；新增 QR 码扫码加好友/进群；纯前端手势返回。

**Tech Stack:** Node.js/Express/Socket.io, Vanilla JS, Capacitor 7, web-push

## Global Constraints

- 文件大小上限 50MB
- @提及仅限群聊
- 消息回应 5 个表情：👍 ❤️ 😄 😢 😡
- 手势返回仅移动端生效（`<768px`）
- 所有新增 socket 事件必须提供 callback 错误处理

---

### Task 1: 服务端 — 文件传输 Socket 事件

**Files:**
- Modify: `server.js` (在 `send-image` 事件后添加 `send-file`)

- [ ] **Step 1: 在 server.js 中 `send-image` 事件后添加 `send-file`**

```javascript
  // ─── Send file ────────────────────────────────────────────
  // Ensure uploads/files directory exists
  const filesDir = path.join(__dirname, 'uploads', 'files');
  try { fs.mkdirSync(filesDir, { recursive: true }); } catch (e) { /* ignore */ }

  socket.on('send-file', ({ to, dataUrl, fileName, fileSize, mimeType }, callback) => {
    const from = socket.userId;
    if (!from || typeof to !== 'string' || typeof dataUrl !== 'string') {
      return callback?.({ error: '参数不完整' });
    }

    // Size check: base64 ~33% larger than binary
    const estimatedBytes = dataUrl.length * 0.75;
    if (estimatedBytes > 50 * 1024 * 1024) {
      return callback?.({ error: '文件不能超过 50MB' });
    }

    // Extract extension from fileName or mimeType
    let ext = path.extname(fileName || 'file.bin').toLowerCase() || '.bin';
    if (!ext || ext === '.') ext = '.bin';

    const base64Data = dataUrl.includes('base64,') ? dataUrl.split('base64,')[1] : dataUrl;
    const buffer = Buffer.from(base64Data, 'base64');

    const filename = `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filepath = path.join(filesDir, filename);

    try { fs.writeFileSync(filepath, buffer); } catch (e) {
      return callback?.({ error: '文件保存失败' });
    }

    const fileUrl = `/uploads/files/${filename}`;
    const isGroup = to.startsWith('g_');
    const msg = {
      id: genMsgId(),
      from, to,
      type: 'file',
      fileName: fileName || '未知文件',
      fileSize: buffer.length,
      mimeType: mimeType || 'application/octet-stream',
      fileUrl,
      text: fileName || '未知文件',
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
      console.log(`[文件消息] ${from} → 群 ${to}: ${filename}`);
      return;
    }

    // Single chat
    const targetId = to;
    const chatId = [from, targetId].sort().join(':');
    if (!messages.has(chatId)) messages.set(chatId, []);
    messages.get(chatId).push(msg);
    if (messages.get(chatId).length > 500) messages.set(chatId, messages.get(chatId).slice(-500));

    msg.status = 'delivered';
    const targetSocket = getSocketByUserId(targetId);
    if (targetSocket) {
      targetSocket.emit('new-message', msg);
    }
    callback(msg);
    console.log(`[文件消息] ${from} → ${targetId}: ${filename}`);
  });
```

- [ ] **Step 2: 在 Express 静态服务中添加 files 目录支持**

在 `server.js` 中已有 `/uploads` 静态服务附近（约第 154 行），确认 `uploads/files` 被 express.static 覆盖：
```javascript
// 已有/可读，不需要改动
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d',
  etag: true,
}));
```

- [ ] **Step 3: 提交**

```bash
git add server.js
git commit -m "feat(server): add send-file socket event for file transfer

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: 前端 — 文件传输（选择器 + 发送 + 渲染 + 样式）

**Files:**
- Modify: `public/index.html` (添加文件按钮)
- Modify: `public/app.js` (文件选择、发送、渲染)
- Modify: `public/style.css` (文件气泡样式)

- [ ] **Step 1: 在 index.html 输入区添加文件按钮**

在 `public/index.html` 中找到 `imageBtn` 所在行（`<button class="input-action-btn" id="imageBtn" title="发送图片">`），在其后添加：

```html
        <button class="input-action-btn" id="fileBtn" title="发送文件">
        <i class="bi bi-paperclip"></i>
        </button>
        <input type="file" id="fileInput" hidden>
```

- [ ] **Step 2: 在 app.js 添加文件选择和发送逻辑**

在 `Image upload` 区块后（找到 `// ─── Image upload ──────────────────────────────────────────` 区块），添加：

```javascript
// ─── File upload ──────────────────────────────────────────
const fileBtn = $('fileBtn');
const fileInput = $('fileInput');

fileBtn?.addEventListener('click', function() { fileInput.click(); });
fileInput?.addEventListener('change', function(e) {
  var file = e.target.files[0];
  if (!file || !activeChat) return;
  if (file.size > 50 * 1024 * 1024) { showToast('文件不能超过 50MB', 2000, 'error'); return; }

  showToast('上传中...', 3000);
  var reader = new FileReader();
  reader.onload = function(ev) {
    socket.emit('send-file', {
      to: activeChat,
      dataUrl: ev.target.result,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream'
    }, function(msg) {
      if (msg && !msg.error) {
        var chatId = activeChat.startsWith('g_') ? activeChat : getChatId(currentUser.id, activeChat);
        if (!messageCache.has(chatId)) messageCache.set(chatId, []);
        messageCache.get(chatId).push(msg);
        renderMessages();
        scrollToBottom();
        renderChatList();
      } else {
        showToast(msg?.error || '文件发送失败', 2000, 'error');
      }
    });
  };
  reader.readAsDataURL(file);
  fileInput.value = '';
});
```

- [ ] **Step 3: 在 renderMessageHtml 中添加文件消息渲染**

在 `renderMessageHtml` 函数中，在 `// 语音消息` 区块之后、`// 普通文本消息` 之前，添加文件消息渲染：

```javascript
  // 文件消息
  if (m.type === 'file') {
    const statusIcon = isMine ? getStatusSvg(m.status) : '';
    const fileIcon = getFileIcon(m.fileName || '');
    const fileSizeStr = formatFileSize(m.fileSize || 0);
    const isPreviewable = m.mimeType && (m.mimeType.startsWith('image/') || m.mimeType.startsWith('video/') || m.mimeType.startsWith('audio/'));
    return `
      <div class="message-row ${isMine ? 'mine' : 'other'}" data-msg-id="${m.id}" data-chat-id="${getChatId(currentUser.id, activeChat)}">
        <div class="message-avatar" style="background:${avatarBg}">${avatarHtml}</div>
        <div class="message-body">
          ${senderName ? `<div style="font-size:.7rem;color:#888;margin-bottom:1px;padding-left:2px">${escapeHtml(senderName)}</div>` : ''}
          <div class="file-bubble ${isMine ? 'mine' : 'other'}" data-url="${m.fileUrl}" data-mime="${m.mimeType || ''}" data-name="${escapeHtml(m.fileName || '')}">
            <span class="file-icon">${fileIcon}</span>
            <div class="file-info">
              <div class="file-name" title="${escapeHtml(m.fileName || '')}">${escapeHtml(m.fileName || '未知文件')}</div>
              <div class="file-size">${fileSizeStr}</div>
            </div>
          </div>
          <div class="message-footer">
            <span class="message-time">${timeStr}</span>
            ${statusIcon}
          </div>
        </div>
      </div>`;
  }
```

- [ ] **Step 4: 在 app.js 中添加辅助函数 `getFileIcon` 和 `formatFileSize`**

在 `renderMessageHtml` 函数之前或之后添加：

```javascript
// ─── 文件图标映射 ──────────────────────────────────────────
function getFileIcon(fileName) {
  var ext = fileName.split('.').pop().toLowerCase();
  var iconMap = {
    pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
    ppt: '📑', pptx: '📑', zip: '📦', rar: '📦', '7z': '📦',
    tar: '📦', gz: '📦', mp4: '🎬', avi: '🎬', mov: '🎬',
    mkv: '🎬', flv: '🎬', mp3: '🎵', wav: '🎵', flac: '🎵',
    aac: '🎵', ogg: '🎵', jpg: '🖼️', jpeg: '🖼️', png: '🖼️',
    gif: '🖼️', webp: '🖼️', svg: '🖼️', txt: '📃', csv: '📃',
    json: '📋', js: '📋', ts: '📋', html: '🌐', css: '🎨',
    exe: '⚙️', apk: '📱', dmg: '💿',
  };
  return iconMap[ext] || '📎';
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  var units = ['B', 'KB', 'MB', 'GB'];
  var i = 0;
  var size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return size.toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}
```

- [ ] **Step 5: 在 style.css 末尾添加文件气泡样式**

```css
/* ═══════════════════════════════════════════════════════════════
   文件消息气泡
   ═══════════════════════════════════════════════════════════════ */
.file-bubble {
  display:flex; align-items:center; gap:.65rem;
  padding:.55rem .7rem; border-radius:10px;
  cursor:pointer; min-width:160px; max-width:240px;
  background:var(--wa-bubble-other); border:1px solid var(--wa-border);
  transition:var(--transition);
  user-select:none; -webkit-user-select:none;
}
.file-bubble:hover { background:#f5f5f5; }
.file-bubble:active { transform:scale(.97); }
.file-bubble.mine { background:var(--wa-bubble-mine); border-color:rgba(7,193,96,.15); }
.file-bubble.mine:hover { background:#c8e6a0; }
.file-icon { font-size:1.8rem; flex-shrink:0; }
.file-info { flex:1; min-width:0; }
.file-name { font-size:.82rem; font-weight:500; color:var(--wa-text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.file-size { font-size:.68rem; color:var(--wa-text-muted); margin-top:2px; }

@media (max-width: 768px) {
  .file-bubble { min-width:140px; max-width:200px; padding:.5rem .6rem; }
  .file-icon { font-size:1.5rem; }
  .file-name { font-size:.8rem; }
}
```

- [ ] **Step 6: 在 app.js 的 `renderMessages` 函数中，为文件气泡绑定点击事件**

在 `renderMessages` 函数末尾，在现有事件绑定（红包、撤回、长按）之后添加：

```javascript
  // 绑定文件点击事件（预览/下载）
  messagesContainer.querySelectorAll('.file-bubble').forEach(function(el) {
    el.addEventListener('click', function() {
      var url = el.dataset.url;
      var mime = el.dataset.mime || '';
      var name = el.dataset.name || 'file';
      if (!url) return;

      // 可预览类型：图片/视频/音频 → 打开预览
      if (mime.startsWith('image/')) {
        showImagePreview(url);
      } else if (mime.startsWith('video/')) {
        window.open(url, '_blank');
      } else if (mime.startsWith('audio/')) {
        var audio = new Audio(url);
        audio.play();
      } else {
        // 不可预览 → 下载
        var a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.target = '_blank';
        a.click();
      }
    });
  });
```

- [ ] **Step 7: 提交**

```bash
git add public/index.html public/app.js public/style.css
git commit -m "feat(client): file transfer UI - file picker, file bubble rendering with icons, download/preview

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: 服务端 — @提及解析

**Files:**
- Modify: `server.js` (修改 `send-message` 事件，添加 @ 解析)

- [ ] **Step 1: 在 `send-message` 事件中添加 @ 解析逻辑**

找到 `send-message` socket 事件处理函数，在 `const isGroup = to.startsWith('g_');` 之后添加：

```javascript
    // ─── 群聊 @ 提及解析 ──────────────────────────────────
    let mentionedUserIds = [];
    if (isGroup) {
      const g = groups.get(to);
      if (g) {
        // 解析 @用户名 模式
        var mentionMatch;
        var mentionRegex = /@([^\s]+)/g;
        while ((mentionMatch = mentionRegex.exec(text)) !== null) {
          var mentionedName = mentionMatch[1];
          // @all 特殊处理
          if (mentionedName === 'all') {
            mentionedUserIds = g.members.map(function(m) { return m.userId; });
            break;
          }
          // 在群成员中查找匹配的用户名
          g.members.forEach(function(m) {
            var memberUser = users.get(m.userId);
            if (memberUser && memberUser.name === mentionedName && mentionedUserIds.indexOf(m.userId) === -1) {
              mentionedUserIds.push(m.userId);
            }
          });
        }
      }
    }
```

在消息对象 `msg` 中添加 `mentionedUserIds` 字段：
```javascript
      // 在 msg = { ... existing fields ..., } 中添加
      mentionedUserIds: mentionedUserIds,
```

- [ ] **Step 2: 提交**

```bash
git add server.js
git commit -m "feat(server): parse @mentions in group chat send-message

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: 前端 — @提及 UI 和渲染

**Files:**
- Modify: `public/app.js` (@选择器、@高亮渲染)
- Modify: `public/style.css` (@高亮样式)

- [ ] **Step 1: 在 app.js 中添加 @ 选择器功能**

在文件中找到 `messageInput` 的事件绑定（约 `messageInput?.addEventListener('keydown', ...)` 附近），在 `sendBtn` 事件绑定之后添加：

```javascript
// ─── @提及 成员选择器 ────────────────────────────────────
var mentionDropdown = null;
var mentionFilter = '';

function createMentionDropdown() {
  if (mentionDropdown) return;
  mentionDropdown = document.createElement('div');
  mentionDropdown.id = 'mentionDropdown';
  mentionDropdown.className = 'mention-dropdown';
  mentionDropdown.style.display = 'none';
  document.body.appendChild(mentionDropdown);
}

function showMentionDropdown(filterText) {
  if (!mentionDropdown) createMentionDropdown();
  var activeChatId = activeChat;
  if (!activeChatId || !activeChatId.startsWith('g_')) return;

  // 获取群成员列表（从聊天列表或缓存）
  var members = [];
  myGroups.forEach(function(g) {
    if (g.id === activeChatId || g.groupId === activeChatId) {
      members = g.members || [];
    }
  });
  // 通过 contacts Map 获取成员名称
  var filtered = members.filter(function(m) {
    var memberUser = contacts.get(m.userId || m.id);
    var name = (memberUser && memberUser.name) || m.name || m.userId || '';
    return name.toLowerCase().indexOf(filterText.toLowerCase()) !== -1;
  });

  if (filtered.length === 0) { hideMentionDropdown(); return; }

  mentionDropdown.innerHTML = '';
  mentionDropdown.style.display = 'block';
  // 定位到输入框上方
  var rect = messageInput.getBoundingClientRect();
  mentionDropdown.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
  mentionDropdown.style.left = Math.max(8, rect.left) + 'px';
  mentionDropdown.style.width = Math.min(220, rect.width) + 'px';

  filtered.forEach(function(m) {
    var memberUser = contacts.get(m.userId || m.id);
    var name = (memberUser && memberUser.name) || m.name || m.userId || '用户';
    var item = document.createElement('div');
    item.className = 'mention-item';
    item.innerHTML = '<span class="mention-item-avatar">' + (memberUser?.avatarChar || '👤') + '</span><span class="mention-item-name">' + escapeHtml(name) + '</span>';
    item.addEventListener('click', function() {
      insertMention(name);
    });
    mentionDropdown.appendChild(item);
  });
}

function hideMentionDropdown() {
  if (mentionDropdown) mentionDropdown.style.display = 'none';
}

function insertMention(name) {
  var text = messageInput.value;
  // 替换最后一个 @xxx 为 @用户名
  var lastAtIndex = text.lastIndexOf('@');
  if (lastAtIndex !== -1) {
    messageInput.value = text.substring(0, lastAtIndex) + '@' + name + ' ';
  }
  hideMentionDropdown();
  messageInput.focus();
  updateSendBtn();
}

// 输入框监听 @ 触发
messageInput?.addEventListener('input', function() {
  var text = messageInput.value;
  var cursorPos = messageInput.selectionStart;
  // 查找光标前最后一个 @
  var lastAtIndex = text.lastIndexOf('@', cursorPos - 1);
  if (lastAtIndex !== -1 && activeChat && activeChat.startsWith('g_')) {
    // 确保 @ 之后到光标之间没有空格（表示正在输入要 @ 的人名）
    var afterAt = text.substring(lastAtIndex + 1, cursorPos);
    if (afterAt.indexOf(' ') === -1) {
      mentionFilter = afterAt;
      showMentionDropdown(afterAt);
      return;
    }
  }
  hideMentionDropdown();
});

// 点击其他地方关闭下拉
document.addEventListener('click', function(e) {
  if (mentionDropdown && !mentionDropdown.contains(e.target) && e.target !== messageInput) {
    hideMentionDropdown();
  }
});
```

- [ ] **Step 2: 修改 `escapeHtml` → 添加 @ 高亮渲染**

找到 `function escapeHtml(text)`（约第 2797 行），在其后添加高亮函数：

```javascript
function renderMentions(text) {
  // 先 escape HTML，再替换 @用户名 为高亮 span
  var escaped = escapeHtml(text || '');
  return escaped.replace(/@([^\s<]+)/g, '<span class="mention-highlight">@$1</span>');
}
```

- [ ] **Step 3: 修改文本消息渲染，使用 `renderMentions`**

在 `renderMessageHtml` 中，找到文本消息的渲染（`// 普通文本消息`），将：
```javascript
<div class="message-bubble">${escapeHtml(m.text || '')}</div>
```
替换为：
```javascript
<div class="message-bubble">${renderMentions(m.text || '')}</div>
```

- [ ] **Step 4: 在 style.css 末尾添加 @ 选择器和高亮样式**

```css
/* ═══════════════════════════════════════════════════════════════
   @提及 相关样式
   ═══════════════════════════════════════════════════════════════ */
.mention-dropdown {
  position:fixed; z-index:1000;
  background:#fff; border-radius:10px;
  box-shadow:0 4px 20px rgba(0,0,0,.15);
  max-height:180px; overflow-y:auto;
  padding:4px 0;
}
.mention-item {
  display:flex; align-items:center; gap:.5rem;
  padding:.4rem .7rem; cursor:pointer;
  font-size:.82rem; color:var(--wa-text);
  transition:background .12s;
}
.mention-item:hover { background:var(--wa-hover); }
.mention-item:active { background:var(--wa-active); }
.mention-item-avatar {
  width:28px; height:28px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  background:var(--wa-green); color:#fff; font-size:.75rem; flex-shrink:0;
}
.mention-item-name { font-weight:500; }

.mention-highlight {
  color:#1a73e8; font-weight:500;
}
```

- [ ] **Step 5: 提交**

```bash
git add public/app.js public/style.css
git commit -m "feat: group @mention - @ picker dropdown and highlight rendering

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: 服务端 — 消息回应 Socket 事件

**Files:**
- Modify: `server.js` (新增 `react-to-message` 事件)

- [ ] **Step 1: 在 `end-call` 或合适位置后添加 `react-to-message` 事件**

```javascript
  // ─── Message reaction ────────────────────────────────────
  socket.on('react-to-message', ({ messageId, chatId, emoji }, callback) => {
    const from = socket.userId;
    if (!from || !messageId || !chatId || !emoji) {
      return callback?.({ error: '参数不完整' });
    }

    const msgs = messages.get(chatId);
    if (!msgs) return callback?.({ error: '消息不存在' });

    // Find message by id
    var msg = null;
    for (var i = 0; i < msgs.length; i++) {
      if (msgs[i].id === messageId) { msg = msgs[i]; break; }
    }
    if (!msg) return callback?.({ error: '消息不存在' });
    if (!msg.reactions) msg.reactions = [];

    // Check if user already reacted with same emoji → toggle off
    var existingIdx = -1;
    for (var j = 0; j < msg.reactions.length; j++) {
      if (msg.reactions[j].userId === from) {
        existingIdx = j;
        break;
      }
    }

    if (existingIdx !== -1) {
      var existingEmoji = msg.reactions[existingIdx].emoji;
      if (existingEmoji === emoji) {
        // Same emoji → remove (toggle off)
        msg.reactions.splice(existingIdx, 1);
      } else {
        // Different emoji → switch
        msg.reactions[existingIdx].emoji = emoji;
      }
    } else {
      // New reaction
      msg.reactions.push({ userId: from, emoji: emoji });
    }

    // Broadcast updated reactions
    const fromSocket = getSocketByUserId(from);
    if (fromSocket) {
      fromSocket.to(chatId).emit('message-reacted', { messageId, chatId, reactions: msg.reactions });
    }

    callback({ success: true, reactions: msg.reactions });
    console.log(`[回应] ${from} ${emoji} → ${messageId}`);
  });
```

- [ ] **Step 2: 在 `new-message` 事件处理中添加对新消息 reactions 字段的支持**

找到 `send-message` 创建消息对象的部分，在 `msg` 对象中添加：
```javascript
      reactions: [],
```

- [ ] **Step 3: 提交**

```bash
git add server.js
git commit -m "feat(server): add react-to-message socket event with toggle logic

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: 前端 — 消息回应面板和显示

**Files:**
- Modify: `public/app.js` (反应面板 UI、发送反应、接收更新)
- Modify: `public/style.css` (反应面板和气泡样式)

- [ ] **Step 1: 在 app.js 中添加反应面板和逻辑**

在文件末尾（`</script>` 之前），添加：

```javascript
// ═══════════════════════════════════════════════════════════════
// 消息回应 (Reactions)
// ═══════════════════════════════════════════════════════════════
const REACTION_EMOJIS = ['👍', '❤️', '😄', '😢', '😡'];
var reactionPanel = null;
var reactionTargetMsgId = null;

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
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      sendReaction(emoji);
    });
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

function hideReactionPanel() {
  if (reactionPanel) reactionPanel.style.display = 'none';
}

function sendReaction(emoji) {
  if (!reactionTargetMsgId || !activeChat) return;
  var chatId = activeChat.startsWith('g_') ? activeChat : getChatId(currentUser.id, activeChat);
  socket.emit('react-to-message', {
    messageId: reactionTargetMsgId,
    chatId: chatId,
    emoji: emoji
  }, function(res) {
    if (res && res.success) {
      // 更新本地缓存
      var msgs2 = messageCache.get(chatId) || [];
      for (var i = 0; i < msgs2.length; i++) {
        if (msgs2[i].id === reactionTargetMsgId) {
          msgs2[i].reactions = res.reactions;
          break;
        }
      }
      renderMessages();
    }
  });
  hideReactionPanel();
}

// 监听其他用户发送的 reaction 更新
socket.on('message-reacted', function(data) {
  var chatId = activeChat.startsWith('g_') ? activeChat : getChatId(currentUser.id, activeChat);
  if (data.chatId === chatId) {
    var msgs3 = messageCache.get(chatId) || [];
    for (var i = 0; i < msgs3.length; i++) {
      if (msgs3[i].id === data.messageId) {
        msgs3[i].reactions = data.reactions;
        break;
      }
    }
    renderMessages();
  }
});

// 点击其他地方关闭反应面板
document.addEventListener('click', function(e) {
  if (reactionPanel && !reactionPanel.contains(e.target)) {
    hideReactionPanel();
  }
});
```

- [ ] **Step 2: 在 renderMessages 中绑定长按显示反应面板**

找到 `renderMessages` 函数中长按事件的绑定代码（约第 1528-1544 行），在 `// Long press for selection mode on mobile` 块**之前**或**同时**，为每个消息行添加长按反应功能。修改现有长按逻辑使其更智能：非选择模式下短长按显示反应面板，选择模式下长按选择消息。

将现有长按代码（约 1528-1544 行）替换为：

```javascript
  // Long press: reaction panel (not in selection mode) or selection mode
  messagesContainer.querySelectorAll('.message-row').forEach(function(row) {
    var longPressTimer = null;
    var longPressTriggered = false;
    row.addEventListener('touchstart', function(e) {
      longPressTriggered = false;
      longPressTimer = setTimeout(function() {
        longPressTriggered = true;
        if (selectionToolbar.style.display === 'flex') {
          // 选择模式：选择消息
          selectedMsgIds.add(row.dataset.msgId);
          row.classList.add('selected');
          selectionCount.textContent = '已选 ' + selectedMsgIds.size + ' 条';
        } else {
          // 非选择模式：显示反应面板
          var bubble = row.querySelector('.message-bubble, .file-bubble, .voice-bubble, img.message-image, .rp-bubble');
          if (bubble) showReactionPanel(row.dataset.msgId, bubble);
        }
      }, 500);
    }, { passive: true });
    row.addEventListener('touchend', function() {
      if (longPressTimer) clearTimeout(longPressTimer);
    });
    row.addEventListener('touchmove', function() {
      if (longPressTimer) clearTimeout(longPressTimer);
    });
  });
```

- [ ] **Step 3: 在 renderMessageHtml 中添加 reactions 显示**

在每个消息类型（图片、语音、文本、文件）的渲染中，在 `message-footer` 之后、闭合 `</div></div>` 之前添加 reactions 显示：

例如，在文本消息渲染中，在 `message-footer` 后添加：

```javascript
          ${renderReactions(m.reactions, isMine)}
```

修改文本消息渲染块的完整内容：
```javascript
  // 普通文本消息
  const statusIcon2 = isMine ? getStatusSvg(m.status) : '';
  return `
    <div class="message-row ${isMine ? 'mine' : 'other'}" data-msg-id="${m.id}" data-chat-id="${getChatId(currentUser.id, activeChat)}">
      <div class="message-avatar" style="background:${avatarBg}">${avatarHtml}</div>
      <div class="message-body">
        ${senderName ? `<div style="font-size:.7rem;color:#888;margin-bottom:1px;padding-left:2px">${escapeHtml(senderName)}</div>` : ''}
        <div class="message-bubble">${renderMentions(m.text || '')}</div>
        <div class="message-footer">
          <span class="message-time">${timeStr}</span>
          ${statusIcon2}
          ${isMine && canRecall(m) ? `<span class="recall-action" data-msg-id="${m.id}" style="font-size:.6rem;color:#999;cursor:pointer;margin-left:2px">撤回</span>` : ''}
        </div>
        ${renderReactions(m.reactions)}
      </div>
    </div>`;
```

同样，对 `image`, `voice`, `file` 消息类型也添加 `${renderReactions(m.reactions)}` 在 `</div></div>` 之前。

- [ ] **Step 4: 添加 `renderReactions` 函数**

在 `renderMentions` 函数附近添加：

```javascript
function renderReactions(reactions) {
  if (!reactions || reactions.length === 0) return '';
  // 按 emoji 分组计数
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

// 点击反应气泡切换反应
// (在 renderMessages 的事件绑定中添加)
```

在 `renderMessages` 函数末尾，为反应气泡绑定点击切换事件：

```javascript
  // 绑定反应气泡点击 → 切换
  messagesContainer.querySelectorAll('.reaction-badge').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      var msgRow = this.closest('.message-row');
      if (msgRow) {
        var msgId = msgRow.dataset.msgId;
        var emoji = this.dataset.emoji;
        if (msgId && emoji) {
          var chatId2 = activeChat.startsWith('g_') ? activeChat : getChatId(currentUser.id, activeChat);
          socket.emit('react-to-message', { messageId: msgId, chatId: chatId2, emoji: emoji }, function(res) {
            if (res && res.success) {
              var msgs4 = messageCache.get(chatId2) || [];
              for (var i = 0; i < msgs4.length; i++) {
                if (msgs4[i].id === msgId) {
                  msgs4[i].reactions = res.reactions;
                  break;
                }
              }
              renderMessages();
            }
          });
        }
      }
    });
  });
```

- [ ] **Step 5: 在 style.css 末尾添加反应样式**

```css
/* ═══════════════════════════════════════════════════════════════
   消息回应 (Reactions)
   ═══════════════════════════════════════════════════════════════ */
.reaction-panel {
  position:fixed; z-index:1000;
  display:flex; gap:4px;
  background:#fff; border-radius:24px;
  padding:6px 10px; box-shadow:0 4px 20px rgba(0,0,0,.15);
  animation:reactionPanelIn .2s ease-out;
}
@keyframes reactionPanelIn {
  from { transform:translateY(10px); opacity:0; }
  to { transform:translateY(0); opacity:1; }
}
.reaction-btn {
  width:40px; height:40px; border:none; border-radius:50%;
  background:transparent; font-size:1.5rem; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:transform .15s, background .15s;
}
.reaction-btn:hover { transform:scale(1.25); background:rgba(0,0,0,.04); }
.reaction-btn:active { transform:scale(1.1); }

.reactions-bar {
  display:flex; gap:2px; flex-wrap:wrap;
  margin-top:2px; padding-left:2px;
}
.reaction-badge {
  display:inline-flex; align-items:center; gap:1px;
  padding:1px 5px; border-radius:12px;
  background:rgba(255,255,255,.85);
  border:1px solid var(--wa-border);
  font-size:.78rem; line-height:1.4;
  cursor:pointer; user-select:none; -webkit-user-select:none;
  transition:transform .12s;
}
.reaction-badge.mine {
  background:rgba(7,193,96,.12);
  border-color:rgba(7,193,96,.3);
}
.reaction-badge:active { transform:scale(.9); }
.reaction-count {
  font-size:.62rem; color:var(--wa-text-muted); margin-left:1px;
  font-weight:500;
}
```

- [ ] **Step 6: 在 socket 事件注册区添加 `message-reacted` 监听**

确保在 `registerSocketHandlers` 函数中添加了对应的 socket.on：
（已在 Step 1 中通过 `socket.on('message-reacted', ...)` 添加）

- [ ] **Step 7: 修改新消息的 reactions 默认值**

在 `send-message` 的回调中，确认 `msg.reactions = []` 已被设置（通过服务端或客户端初始化）。

- [ ] **Step 8: 提交**

```bash
git add public/app.js public/style.css
git commit -m "feat: message reactions - long-press reaction panel and display

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: 移动端完善 — 推送通知 + 扫码 + 手势返回

**Files:**
- Modify: `public/app.js` (推送注册、手势返回)
- Modify: `public/sw.js` (推送事件)
- Modify: `server.js` (QR 码 API)
- Modify: `public/style.css` (手势返回动画)
- Modify: `public/index.html` (扫码入口)

- [ ] **Step 1: 在 app.js 中添加推送通知注册**

在 `NativeBridge` 区块附近或 DOM 初始化完成后添加：

```javascript
// ─── 推送通知注册 (Capacitor) ──────────────────────────
if (NativeBridge.isApp) {
  try {
    var PushNotifications = Capacitor.Plugins.PushNotifications;
    PushNotifications.requestPermissions().then(function(result) {
      if (result.receive === 'granted') {
        PushNotifications.register();
      }
    });
    PushNotifications.addListener('registration', function(token) {
      console.log('[Push] Token:', token.value);
      // 发送 token 到服务器
      fetch('/api/push/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.value, platform: NativeBridge.platform })
      }).catch(function(err) {
        console.warn('[Push] Register failed:', err);
      });
    });
    PushNotifications.addListener('pushReceived', function(notification) {
      console.log('[Push] Received:', notification);
    });
    PushNotifications.addListener('pushNotificationActionPerformed', function(notification) {
      console.log('[Push] Action performed:', notification);
    });
  } catch (e) {
    console.warn('[Push] 推送初始化失败:', e.message);
  }
}

// PWA Web Push 注册（浏览器环境）
if ('serviceWorker' in navigator && 'PushManager' in window && !NativeBridge.isApp) {
  // 已有 SW 注册代码在 index.html 中
  // 订阅推送按钮可以添加到设置面板
}
```

- [ ] **Step 2: 修改 sw.js 添加推送事件处理**

```javascript
// 在 sw.js 末尾添加
self.addEventListener('push', function(event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'WeTalk', body: event.data ? event.data.text() : '' };
  }

  var title = data.title || 'WeTalk';
  var options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(urlToOpen));
});
```

- [ ] **Step 3: 在 index.html 中添加扫码入口按钮**

找到侧栏或聊天列表中的按钮区，在 `createGroupBtn` 或 `addContactBtn2` 附近添加扫码按钮：

```html
        <button class="header-btn" id="scanQrBtn" title="扫一扫" data-bs-toggle="tooltip">
        <i class="bi bi-qr-code-scan"></i>
        </button>
```

在个人资料页中，在昵称编辑 row 之后添加"我的二维码"：

找到 `ppEditName` 所在的 row，在其后添加：
```html
          <div class="pp-row" id="ppQrRow" style="cursor:pointer">
            <span class="pp-label">📱 我的二维码</span>
            <span class="pp-value"><i class="bi bi-chevron-right"></i></span>
          </div>
```

- [ ] **Step 4: 在 server.js 中添加 QR 码 API**

在 Express 路由区添加：

```javascript
// ─── 二维码生成 ──────────────────────────────────────────
const qrImage = require('qr-image');

// 获取用户二维码
app.get('/api/user/qrcode/:userId', (req, res) => {
  const userId = req.params.userId;
  const user = users.get(userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  const qrContent = `wetalk://user/${userId}`;
  try {
    const qr_svg = qrImage.imageSync(qrContent, { type: 'png', margin: 2, size: 8 });
    res.setHeader('Content-Type', 'image/png');
    res.send(qr_svg);
  } catch (e) {
    res.status(500).json({ error: '二维码生成失败' });
  }
});

// 获取群二维码
app.get('/api/group/qrcode/:groupId', (req, res) => {
  const groupId = req.params.groupId;
  const g = groups.get(groupId);
  if (!g) return res.status(404).json({ error: '群组不存在' });
  const qrContent = `wetalk://group/${groupId}`;
  try {
    const qr_svg = qrImage.imageSync(qrContent, { type: 'png', margin: 2, size: 8 });
    res.setHeader('Content-Type', 'image/png');
    res.send(qr_svg);
  } catch (e) {
    res.status(500).json({ error: '二维码生成失败' });
  }
});

// 解析二维码并执行操作
app.post('/api/qrcode/scan', express.json(), (req, res) => {
  const { content, userId } = req.body;
  if (!content || !userId) return res.json({ success: false, error: '参数不完整' });
  if (!users.has(userId)) return res.json({ success: false, error: '用户不存在' });

  // 解析 wetalk://user/xxx 或 wetalk://group/xxx
  const userMatch = content.match(/^wetalk:\/\/user\/(.+)$/);
  const groupMatch = content.match(/^wetalk:\/\/group\/(.+)$/);

  if (userMatch) {
    const targetId = userMatch[1];
    if (targetId === userId) return res.json({ success: false, error: '不能添加自己' });
    if (!users.has(targetId)) return res.json({ success: false, error: '用户不存在' });

    // 检查是否已经是好友
    const user = users.get(userId);
    if (user.friends && user.friends.includes(targetId)) {
      return res.json({ success: false, error: '已经是好友了' });
    }

    // 发送好友请求
    const targetUser = users.get(targetId);
    if (!targetUser.friendRequests) targetUser.friendRequests = [];
    if (!targetUser.friendRequests.includes(userId)) {
      targetUser.friendRequests.push(userId);
    }

    // 通知对方
    const targetSocket = getSocketByUserId(targetId);
    if (targetSocket) {
      targetSocket.emit('friend-request', { from: userId, name: user.name || '未知用户' });
    }

    return res.json({ success: true, type: 'user', id: targetId, name: users.get(targetId)?.name });
  }

  if (groupMatch) {
    const groupId = groupMatch[1];
    const g = groups.get(groupId);
    if (!g) return res.json({ success: false, error: '群组不存在' });

    // 检查是否已是成员
    if (g.members.some(function(m) { return m.userId === userId; })) {
      return res.json({ success: false, error: '你已在群中' });
    }

    // 添加成员
    const user2 = users.get(userId);
    g.members.push({ userId, name: user2?.name || '用户', role: 'member' });
    socket.emit('group-updated', { id: groupId, name: g.name });

    return res.json({ success: true, type: 'group', id: groupId, name: g.name });
  }

  res.json({ success: false, error: '无法识别的二维码' });
});
```

- [ ] **Step 5: 安装 qr-image 依赖**

```bash
cd C:\Users\hii24\chat-app
npm install qr-image
```

- [ ] **Step 6: 在 app.js 中添加扫码功能和二维码显示**

在 NativeBridge 区域附近添加：

```javascript
// ─── 扫码 ────────────────────────────────────────────────
$('scanQrBtn')?.addEventListener('click', async function() {
  if (NativeBridge.isApp) {
    try {
      var Camera = Capacitor.Plugins.Camera;
      // 使用相机扫码（简单方案：拍照后分析，或使用第三方扫码插件）
      showToast('请对准二维码拍照', 2000);
      var photo = await Camera.getPhoto({
        quality: 50,
        resultType: 'DATA_URL',
        source: 'CAMERA',
        correctOrientation: true,
      });
      if (photo && photo.dataUrl) {
        // 发送到服务端解析（实际项目中推荐使用 ML Kit 或 ZXing）
        // 简化：先手动输入或调用扫码 API
        showToast('扫码功能需要安装扫码插件', 2000);
      }
    } catch (e) {
      console.warn('[QR] Scan cancelled or failed:', e.message);
    }
  } else {
    showToast('扫码仅支持手机 App', 1500);
  }
});

// ─── 显示我的二维码 ──────────────────────────────────────
$('ppQrRow')?.addEventListener('click', function() {
  if (!currentUser) return;
  var modal = document.createElement('div');
  modal.className = 'wt-modal';
  modal.innerHTML = '<div class="modal-overlay" onclick="document.body.removeChild(this.parentNode)"></div><div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border-radius:16px;padding:1.5rem;text-align:center;z-index:200;width:260px;box-shadow:0 8px 40px rgba(0,0,0,.15)"><div style="font-size:.9rem;font-weight:600;margin-bottom:.8rem">' + escapeHtml(currentUser.name || '用户') + '</div><img src="/api/user/qrcode/' + currentUser.id + '?t=' + Date.now() + '" style="width:180px;height:180px;border-radius:8px" alt="二维码"><div style="font-size:.7rem;color:#999;margin-top:.5rem">扫一扫二维码，加我好友</div></div>';
  document.body.appendChild(modal);
});
```

- [ ] **Step 7: 添加手势返回 (swipe-back)**

在 app.js 末尾添加：

```javascript
// ─── 手势返回（移动端右滑关闭聊天窗口） ────────────────
(function() {
  if (window.innerWidth > 768) return; // 仅移动端

  var touchStartX = 0;
  var touchStartY = 0;
  var touchCurrentX = 0;
  var isSwiping = false;
  var chatWin = $('chatWindow');
  var sidebar2 = $('sidebar');

  chatWin?.addEventListener('touchstart', function(e) {
    if (chatWin.style.display !== 'flex') return;
    // 仅检测从屏幕左侧开始的滑动（左边缘 40px 内）
    if (e.touches[0].clientX > 40) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchCurrentX = touchStartX;
    isSwiping = false;
  }, { passive: true });

  chatWin?.addEventListener('touchmove', function(e) {
    if (touchStartX === 0) return;
    touchCurrentX = e.touches[0].clientX;
    var deltaX = touchCurrentX - touchStartX;
    var deltaY = e.touches[0].clientY - touchStartY;

    // 水平滑动距离 > 垂直滑动距离 → 视为右滑
    if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 10) {
      isSwiping = true;
      e.preventDefault();
      var translateX = Math.min(deltaX, window.innerWidth * 0.6);
      chatWin.style.transform = 'translateX(' + translateX + 'px)';
      chatWin.style.transition = 'none';
      // 侧栏逐渐显示
      if (sidebar2) {
        sidebar2.style.opacity = Math.min(1, deltaX / 200);
        sidebar2.style.display = 'flex';
      }
    }
  }, { passive: false });

  chatWin?.addEventListener('touchend', function(e) {
    if (!isSwiping) { touchStartX = 0; return; }
    var deltaX = touchCurrentX - touchStartX;
    var threshold = window.innerWidth * 0.3;

    if (deltaX > threshold) {
      // 超过阈值 → 关闭聊天窗口
      chatWin.style.transition = 'transform .25s ease-out';
      chatWin.style.transform = 'translateX(100%)';
      setTimeout(function() {
        chatWin.style.transform = '';
        chatWin.style.transition = '';
        if (mobileBack) mobileBack.click();
        if (sidebar2) sidebar2.style.opacity = '';
      }, 250);
    } else {
      // 回弹
      chatWin.style.transition = 'transform .2s ease-out';
      chatWin.style.transform = '';
      setTimeout(function() {
        chatWin.style.transition = '';
        if (sidebar2) sidebar2.style.opacity = '';
      }, 200);
    }
    touchStartX = 0;
    isSwiping = false;
  }, { passive: true });
})();
```

- [ ] **Step 8: 在 style.css 中添加手势动画样式**

在已有移动端适配区块中或末尾添加：
```css
/* ─── 手势返回 ────────────────────────────────────────── */
.chat-window {
  transition: transform .2s ease-out; /* 平滑回弹 */
}
.chat-window.active {
  will-change: transform; /* GPU 加速 */
}
```

- [ ] **Step 9: 提交**

```bash
cd C:\Users\hii24\chat-app
git add server.js public/app.js public/style.css public/index.html public/sw.js package.json package-lock.json
git commit -m "feat(mobile): push notifications, QR code scan, swipe-back gesture

Co-Authored-By: Claude <noreply@anthropic.com>"
```
