# WeTalk 移动端适配 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 解决 Capacitor 移动端打字不适配和设备权限无法获取的问题

**Architecture:** 移除 Capacitor 的 iframe 包装层，让 WebView 直连远程服务器，使 `window.Capacitor` 桥接层在 Web App 中可用；安装原生插件提供相机/麦克风/键盘监听能力；添加 NativeBridge 工具层做渐进降级；完善移动端 CSS 适配。

**Tech Stack:** Capacitor 7, Android SDK, Node.js, CSS3, Vanilla JS

## Global Constraints

- Capacitor 插件必须用 `^7.0.0` 版本以匹配现有 `@capacitor/core@^7.0.0`
- 所有 Web App 原生调用必须提供浏览器 API 降级方案
- CSS 移动端适配仅修改现有 `style.css`，不新增样式文件
- `mobile/src/index.html` 和 `public/app.js` 是主要修改文件
- AndroidManifest.xml 修改后需保留所有现有权限

---

### Task 1: 安装 Capacitor 插件及更新配置

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/capacitor.config.json`（确认）
- Run: `cd mobile && npm install`

- [ ] **Step 1: 安装原生插件依赖**

```bash
cd C:\Users\hii24\chat-app\mobile
npm install @capacitor/camera@^7.0.0 @capacitor/filesystem@^7.0.0 @capacitor/device@^7.0.0 @capacitor/keyboard@^7.0.0 @capacitor/network@^7.0.0
```

Expected: `node_modules` 更新，`package.json` 和 `package-lock.json` 更新

- [ ] **Step 2: 确认 capacitor.config.json 配置**

确保 `mobile/capacitor.config.json` 包含:
- `server.url` 指向 Railway 服务器 URL
- Keyboard 插件配置 `resize: "body"`（当前已有）
- Android `allowMixedContent: false`（当前已有）

当前配置已验证无误，无需改动。

- [ ] **Step 3: 同步 Capacitor 平台（生成 Android 原生配置）**

```bash
cd C:\Users\hii24\chat-app\mobile
npx cap sync android
```

Expected: `mobile/android/` 目录更新，包含新插件的原生代码

- [ ] **Step 4: 提交**

```bash
cd C:\Users\hii24\chat-app
git add mobile/package.json mobile/package-lock.json mobile/capacitor.config.json
git commit -m "feat(mobile): add Capacitor plugins (camera, filesystem, device, keyboard, network)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: 重写 mobile/src/index.html — 移除 iframe

**Files:**
- Rewrite: `mobile/src/index.html`

**Interfaces:**
- Consumes: Task 1 (插件安装完毕)
- Produces: 新的加载入口页（无 iframe），WebView 直连 server.url

**说明：** 原先 `index.html` 用 iframe 加载远程服务器，导致 Capacitor 桥接不可用。Capacitor 配置中已有 `server.url`，WebView 会自动加载该 URL，所以 `index.html` 只需作为加载失败时的备用页面或过渡页。

- [ ] **Step 1: 重写 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, height=device-height">
<title>WeTalk</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body {
    width:100%; height:100%; overflow:hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
    background: #075E54;
  }
  #splash {
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    height:100%; color:#fff; padding:2rem;
  }
  .splash-logo {
    width:80px; height:80px; border-radius:20px;
    background:linear-gradient(135deg,#25D366,#1aad19);
    display:flex; align-items:center; justify-content:center;
    font-size:2rem; font-weight:700; margin-bottom:1.5rem;
    box-shadow:0 8px 32px rgba(0,0,0,.15);
  }
  .splash-title { font-size:1.5rem; font-weight:600; margin-bottom:.5rem; }
  .splash-subtitle { font-size:.85rem; opacity:.7; margin-bottom:2rem; }
  .progress-bar {
    width:160px; height:3px; background:rgba(255,255,255,.2); border-radius:2px; overflow:hidden;
  }
  .progress-fill {
    width:30%; height:100%; background:#25D366; border-radius:2px;
    animation:progressPulse 1.5s ease-in-out infinite;
  }
  @keyframes progressPulse {
    0% { width:10%; }
    50% { width:70%; }
    100% { width:10%; }
  }
  .splash-error {
    display:none; text-align:center; margin-top:2rem;
  }
  .splash-error button {
    margin-top:.8rem; padding:.5rem 1.5rem; border:2px solid rgba(255,255,255,.5);
    border-radius:8px; background:transparent; color:#fff; font-size:.85rem; cursor:pointer;
  }
  .splash-error button:active { background:rgba(255,255,255,.1); }
</style>
</head>
<body>
  <div id="splash">
    <div class="splash-logo">W</div>
    <div class="splash-title">WeTalk</div>
    <div class="splash-subtitle">安全 · 畅聊 · 自在</div>
    <div class="progress-bar"><div class="progress-fill"></div></div>
    <div class="splash-error" id="splashError">
      <p>⚠️ 加载失败，请检查网络</p>
      <button onclick="location.reload()">重试</button>
    </div>
  </div>
  <script>
    // Capacitor 的 server.url 配置会让 WebView 自动导航到远程 URL
    // 如果 WebView 加载失败（网络错误），显示错误 UI
    // 被 server.url 替换后，这个页面通常一闪而过
    const splashError = document.getElementById('splashError');

    // 5 秒后如果 still here（可能是加载失败），显示错误
    let errorTimer = setTimeout(() => {
      splashError.style.display = 'block';
    }, 8000);

    // 监听 Capacitor 网络状态变化
    if (typeof Capacitor !== 'undefined') {
      const Network = Capacitor.Plugins.Network;
      Network.addListener('networkStatusChange', (status) => {
        if (!status.connected) {
          splashError.style.display = 'block';
        } else {
          splashError.style.display = 'none';
        }
      });
    }

    // 如果页面通过 API 检测到加载完成，清除错误计时器
    document.addEventListener('DOMContentLoaded', () => {
      // 如果用户能看见这个页面说明 server.url 没生效或加载中
      // Capacitor 配置了 server.url 的情况下，这个页面几乎不会显示
    });

    // 页面可见性变化时清除错误计时器（可能已跳转）
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearTimeout(errorTimer);
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: 验证文件写入**

确认 `mobile/src/index.html` 内容已更新，不包含 `<iframe>` 标签。

- [ ] **Step 3: 提交**

```bash
cd C:\Users\hii24\chat-app
git add mobile/src/index.html
git commit -m "refactor(mobile): remove iframe wrapper, use Capacitor server.url directly

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Android 原生权限声明

**Files:**
- Modify: `mobile/android/app/src/main/AndroidManifest.xml`

**说明：** 添加相机、麦克风、媒体文件读取权限。Android 13+ 使用细粒度权限，低版本使用传统 `READ_EXTERNAL_STORAGE`。

- [ ] **Step 1: 修改 AndroidManifest.xml，添加权限声明**

在现有 `</manifest>` 之前、`<uses-permission android:name="android.permission.INTERNET" />` 之后添加：

```xml

    <!-- Camera & Microphone -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />

    <!-- Network -->
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <!-- Media (Android 13+) -->
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />

    <!-- Legacy storage (Android 12-) -->
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />
```

修改后的完整 `AndroidManifest.xml` 权限区应包含 `INTERNET` + 以上新增的 9 条权限。

- [ ] **Step 2: 提交**

```bash
cd C:\Users\hii24\chat-app
git add mobile/android/app/src/main/AndroidManifest.xml
git commit -m "feat(mobile): add Android permissions for camera, mic, media access

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: 移动端 UI 适配 (CSS)

**Files:**
- Modify: `public/style.css`

**说明：** 在 `style.css` 末尾（`@supports (padding-top:env(safe-area-inset-top))` 块之后）添加增强的移动端媒体查询规则。覆盖已有 `@media (max-width:768px)` 和 `@media (max-width:480px)` 规则中不完善的部分。

- [ ] **Step 1: 在 style.css 末尾添加移动端增强样式**

找到文件末尾的 `@supports (padding-top:env(safe-area-inset-top)) {...}` 块（约第 1248-1252 行），在其**之后**添加以下增强代码：

```css

/* ═══════════════════════════════════════════════════════════════
   移动端适配 v2 — 增强
   ═══════════════════════════════════════════════════════════════ */

/* ─── 输入区增强 ────────────────────────────────────────── */
@media (max-width: 768px) {
  .input-area {
    padding: .45rem .5rem !important;
    padding-bottom: calc(.45rem + env(safe-area-inset-bottom, 0px)) !important;
    gap: .3rem;
    flex-shrink: 0;
  }
  .input-wrapper {
    flex: 1;
    min-width: 0;
  }
  .input-wrapper input {
    font-size: 1rem !important;      /* 防止 iOS 自动缩放 */
    padding: .55rem .85rem !important;
    min-height: 40px;
  }
  .input-action-btn {
    width: 38px;
    height: 38px;
    font-size: 1.15rem !important;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .send-btn {
    padding: .35rem .7rem !important;
    font-size: .88rem !important;
    min-height: 38px;
    flex-shrink: 0;
  }
  /* 移动端隐藏低频按钮，减少输入区拥挤 */
  #redpacketBtn { display: none; }
  #emojiBtn { display: none; }

  /* ─── 聊天列表触控优化 ──────────────────────────────── */
  .chat-item, .contact-item {
    padding: .65rem .8rem !important;
    min-height: 58px;
  }
  .chat-item .avatar, .contact-item .avatar {
    width: 44px !important;
    height: 44px !important;
    font-size: .85rem !important;
  }
  .chat-item .chat-info .chat-name {
    font-size: .9rem;
  }
  .chat-item .chat-info .chat-preview {
    font-size: .8rem;
  }

  /* ─── 聊天窗口全屏 ──────────────────────────────────── */
  .chat-window.active {
    position: fixed;
    inset: 0;
    z-index: 100;
    padding-top: 0;
  }
  .chat-window.active .chat-header {
    padding-top: calc(.5rem + env(safe-area-inset-top, 0px)) !important;
    min-height: 52px;
  }
  .chat-window.active .messages-container {
    flex: 1;
    height: auto;
  }
  .mobile-back {
    display: flex !important;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    font-size: 1.2rem;
  }

  /* ─── 消息气泡触控 ──────────────────────────────────── */
  .message-body {
    max-width: 82% !important;
  }
  .message-bubble {
    padding: .5rem .75rem !important;
    font-size: .9rem !important;
  }
  .message-avatar {
    width: 32px !important;
    height: 32px !important;
    font-size: .7rem !important;
  }

  /* ─── 侧栏 Tab 优化 ──────────────────────────────────── */
  .tab {
    font-size: .82rem !important;
    padding: .55rem .3rem !important;
    flex: 1;
  }
  .tab i {
    font-size: 1.05rem;
  }

  /* ─── 骨架屏适配 ────────────────────────────────────── */
  .msg-loading-skeleton {
    padding: .5rem .6rem;
  }
}

/* ─── 小屏手机优化 ──────────────────────────────────── */
@media (max-width: 380px) {
  .chat-item { padding: .5rem .6rem !important; min-height: 52px; }
  .chat-item .avatar, .contact-item .avatar { width: 38px !important; height: 38px !important; }
  .message-bubble { font-size: .85rem !important; max-width: 88%; }
  .input-action-btn { width: 34px; height: 34px; font-size: 1rem !important; }
  .input-wrapper input { font-size: .9rem !important; padding: .45rem .7rem !important; min-height: 36px; }
  .send-btn { font-size: .82rem !important; padding: .3rem .6rem !important; min-height: 34px; }
  /* 小屏隐藏语音按钮，进一步释放输入区 */
  #voiceBtn { display: none; }
}

/* ─── 登录/注册页移动端适配 ──────────────────────────── */
@media (max-width: 768px) {
  .login-card {
    width: 100% !important;
    max-width: 100% !important;
    padding: 1.5rem 1.2rem !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    background: transparent !important;
    min-height: 100vh;
    justify-content: center;
  }
  .login-card .login-logo h1 {
    font-size: 2rem;
  }
  .login-card .login-logo .login-subtitle {
    font-size: .8rem;
  }
  .input-group input {
    font-size: 1rem !important;
    padding: .7rem .8rem !important;
    min-height: 44px;
  }
  .btn-primary {
    min-height: 44px;
    font-size: .95rem;
  }
  .login-tabs {
    margin-bottom: 1rem;
  }
  .login-tab {
    font-size: .9rem;
    padding: .4rem .8rem;
  }
  .login-bg {
    display: none;
  }
  #loginPage {
    background: linear-gradient(135deg, #075E54 0%, #1aad19 100%);
  }
}

/* ─── 个人资料页移动端适配 ────────────────────────────── */
@media (max-width: 768px) {
  .profile-panel {
    padding: .8rem .6rem !important;
  }
  .pp-avatar {
    width: 64px !important;
    height: 64px !important;
    font-size: 1.3rem !important;
  }
  .pp-section {
    padding: 0 .6rem !important;
  }
  .pp-row {
    padding: .55rem 0 !important;
  }
  .pp-label {
    font-size: .78rem !important;
  }
}

/* ─── 弹窗/Modal 移动端适配 ───────────────────────────── */
@media (max-width: 768px) {
  .wt-modal .modal-dialog {
    margin: 0;
    max-width: 100%;
  }
  .wt-modal .modal-content {
    border-radius: 0;
    min-height: 100vh;
  }
  .rp-modal {
    width: 92% !important;
    max-width: 340px;
  }
  .rp-open-card {
    width: 85% !important;
    max-width: 280px;
  }

  /* ─── 搜索栏适配 ────────────────────────────────────── */
  .search-box {
    padding: .35rem .6rem !important;
  }
  .search-box input {
    font-size: .88rem;
    padding: .35rem .7rem .35rem 2rem !important;
  }
}

/* ─── 侧栏个人资料适配 ────────────────────────────────── */
@media (max-width: 768px) {
  .sidebar-profile {
    padding: .5rem .65rem !important;
    padding-top: calc(.5rem + env(safe-area-inset-top, 0px)) !important;
  }
  .profile-name {
    font-size: .85rem !important;
  }
  .profile-status {
    font-size: .7rem !important;
  }
  .profile-avatar {
    width: 38px !important;
    height: 38px !important;
    font-size: .85rem !important;
  }
  .profile-actions {
    gap: 1px;
  }
  .header-btn {
    width: 32px !important;
    height: 32px !important;
    font-size: .9rem !important;
  }
}

/* ─── iOS 键盘安全区（无 notch 的旧机型） ─────────────── */
@supports (padding-bottom: constant(safe-area-inset-bottom)) {
  @media (max-width: 768px) {
    .input-area {
      padding-bottom: calc(.45rem + constant(safe-area-inset-bottom, 0px)) !important;
    }
    .chat-window.active .chat-header {
      padding-top: calc(.5rem + constant(safe-area-inset-top, 0px)) !important;
    }
    .sidebar-profile {
      padding-top: calc(.5rem + constant(safe-area-inset-top, 0px)) !important;
    }
  }
}
```

- [ ] **Step 2: 验证 CSS 语法**

确认新增代码中所有花括号 `{ }` 匹配合法，没有遗漏闭合。

- [ ] **Step 3: 提交**

```bash
cd C:\Users\hii24\chat-app
git add public/style.css
git commit -m "style(mobile): enhanced mobile responsive CSS - input area, touch targets, safe-area, login page

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: NativeBridge 桥接层 & App.js 集成

**Files:**
- Modify: `public/app.js`

**Interfaces:**
- Consumes: Task 1 (插件可用), Task 2 (iframe 移除, Capacitor 桥接可用)
- Produces: `window.NativeBridge` 全局对象

**说明：** 在 `public/app.js` 文件头部（全局变量区域）添加 `NativeBridge` 工具对象，然后修改图片选择、语音录制等位置的逻辑，优先使用 Capacitor 原生 API，不可用时自动降级。

- [ ] **Step 1: 在 app.js 全局变量区添加 NativeBridge**

插入位置：在 `// ─── 状态 ──────────────────────────────────────────────────` 区块之前（约第 73 行前），或放在全局 DOM 引用之后（约第 230 行 `let selectedMsgIds` 之后）。

建议位置：在 `let selectedMsgIds = new Set();`（第 222 行）之后、`// Image upload`（第 224 行）之前添加：

```javascript
// ═══════════════════════════════════════════════════════════════
// NativeBridge — Capacitor 原生能力桥接（自动降级）
// ═══════════════════════════════════════════════════════════════
const NativeBridge = {
  get isApp() {
    return typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform();
  },
  get platform() {
    if (!this.isApp) return 'web';
    return Capacitor.getPlatform(); // 'ios' | 'android'
  },

  // ─── 相机/相册 ──────────────────────────────────────────
  async pickImage() {
    if (!this.isApp) {
      // 浏览器降级：通过临时 input 触发
      return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) { resolve(null); return; }
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target.result);
          reader.onerror = () => reject(new Error('FileReader failed'));
          reader.readAsDataURL(file);
        };
        input.click();
      });
    }
    try {
      const Camera = Capacitor.Plugins.Camera;
      const image = await Camera.pickImages({
        quality: 80,
        limit: 1,
        correctOrientation: true,
      });
      if (image && image.photos && image.photos.length > 0) {
        return image.photos[0].dataUrl || image.photos[0].path;
      }
      return null;
    } catch (e) {
      console.warn('[NativeBridge] Camera.pickImages failed, fallback:', e.message);
      return this.pickImageLegacy();
    }
  },

  // legacy 降级方式
  pickImageLegacy() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) { resolve(null); return; }
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.readAsDataURL(file);
      };
      input.click();
    });
  },

  // ─── 麦克风权限 ────────────────────────────────────────
  async requestMicPermission() {
    if (!this.isApp) {
      // 浏览器直接用 getUserMedia
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        return true;
      } catch {
        return false;
      }
    }
    try {
      // Android 上 Capacitor 自动处理权限，无需额外请求
      // 但对于麦克风，测试是否能获取流
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      return true;
    } catch {
      return false;
    }
  },

  // ─── 键盘监听 ──────────────────────────────────────────
  keyboardListeners: [],
  onKeyboardShow(callback) {
    if (!this.isApp) return;
    const Keyboard = Capacitor.Plugins.Keyboard;
    const listener = Keyboard.addListener('keyboardWillShow', (info) => {
      callback(info.keyboardHeight);
    });
    this.keyboardListeners.push(listener);
  },
  onKeyboardHide(callback) {
    if (!this.isApp) return;
    const Keyboard = Capacitor.Plugins.Keyboard;
    const listener = Keyboard.addListener('keyboardWillHide', () => {
      callback();
    });
    this.keyboardListeners.push(listener);
  },
  removeKeyboardListeners() {
    this.keyboardListeners.forEach(l => l.remove());
    this.keyboardListeners = [];
  },

  // ─── 网络状态 ──────────────────────────────────────────
  getNetworkStatus() {
    if (!this.isApp) {
      return Promise.resolve({ connected: navigator.onLine });
    }
    const Network = Capacitor.Plugins.Network;
    return Network.getStatus();
  },
};

// NativeBridge 初始化：仅 App 环境时绑定键盘事件
if (NativeBridge.isApp) {
  // 键盘弹出：给 messagesContainer 添加标识，让 CSS 可针对性调整
  NativeBridge.onKeyboardShow((height) => {
    if (messagesContainer) {
      messagesContainer.classList.add('keyboard-open');
      messagesContainer.style.paddingBottom = (height + 60) + 'px';
    }
    scrollToBottom();
  });
  NativeBridge.onKeyboardHide(() => {
    if (messagesContainer) {
      messagesContainer.classList.remove('keyboard-open');
      messagesContainer.style.paddingBottom = '';
    }
  });

  console.log('[NativeBridge] 已初始化, platform:', NativeBridge.platform);
}
```

- [ ] **Step 2: 修改图片选择逻辑，使用 NativeBridge**

找到 `// ─── Image upload ──────────────────────────────────────────`（约第 1600 行），修改 `imageBtn` 的点击事件：

将原有的：
```javascript
imageBtn?.addEventListener('click', () => imageInput.click());
```

替换为：
```javascript
imageBtn?.addEventListener('click', async () => {
  if (NativeBridge.isApp) {
    // App 内优先使用 Capacitor Camera 插件
    const dataUrl = await NativeBridge.pickImage();
    if (!dataUrl || !activeChat) return;
    sendImageData(dataUrl);
  } else {
    // 浏览器降级：触发 file input
    imageInput.click();
  }
});
```

新增 `sendImageData` 函数（放在 `imageBtn` 事件监听之前或之后），将原来 `imageInput.onchange` 中的发送逻辑提取为独立函数：

```javascript
function sendImageData(dataUrl) {
  if (!dataUrl || !activeChat) return;
  // 检查大小：dataUrl base64 长度 ≈ 文件大小 * 1.37
  const estimatedBytes = dataUrl.length * 0.75;
  if (estimatedBytes > 5 * 1024 * 1024) {
    showToast('图片不能超过 5MB', 2000, 'error');
    return;
  }
  showToast('上传中...', 3000);
  socket.emit('send-image', { to: activeChat, dataUrl }, (msg) => {
    if (msg && !msg.error) {
      const chatId = activeChat.startsWith('g_') ? activeChat : getChatId(currentUser.id, activeChat);
      if (!messageCache.has(chatId)) messageCache.set(chatId, []);
      messageCache.get(chatId).push(msg);
      renderMessages();
      scrollToBottom();
      renderChatList();
    } else {
      showToast(msg?.error || '图片发送失败', 2000, 'error');
    }
  });
}
```

保留原有 `imageInput?.addEventListener('change', ...)` 作为浏览器降级路径（已有）。

- [ ] **Step 3: 增强语音录制权限处理**

找到 `async function startRecording()`（约第 1645 行），在调用 `navigator.mediaDevices.getUserMedia` 之前添加权限预检：

```javascript
async function startRecording() {
  if (!activeChat) return;
  try {
    // 预检麦克风权限
    const hasMic = await NativeBridge.requestMicPermission();
    if (!hasMic) {
      showToast('请允许麦克风权限', 2000, 'error');
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // ... 原有代码不变
```

- [ ] **Step 4: 验证代码**

确认：
1. `NativeBridge` 对象语法正确，无引用未定义变量
2. `sendImageData` 函数会被 `imageBtn` 和 `imageInput.change` 适当调用
3. 所有降级路径完整

- [ ] **Step 5: 提交**

```bash
cd C:\Users\hii24\chat-app
git add public/app.js
git commit -m "feat(mobile): add NativeBridge layer for Capacitor plugins with browser fallback

- Camera.pickImages for photo capture with file input fallback
- Keyboard show/hide listeners for layout adjustment
- Mic permission pre-check for voice recording
- Auto-detect native platform vs browser

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: 验证与修复

**Files:**
- Run: `node server.js` 本地测试
- Run: `cd mobile && npx cap sync`（确保 Android 项目可编译）

- [ ] **Step 1: 确认服务端正常运行**

```bash
cd C:\Users\hii24\chat-app
node server.js &
# 等待服务器启动
curl -s http://localhost:3000 | head -20
```

Expected: 返回 HTML，服务器正常启动，无崩溃

- [ ] **Step 2: 验证 Capacitor 同步**

```bash
cd C:\Users\hii24\chat-app\mobile
npx cap sync android 2>&1
```

Expected: 同步成功，无报错。AndroidManifest.xml 中应包含新添加的权限

- [ ] **Step 3: 代码审查 — 检查关键逻辑**

逐项确认：
- `mobile/src/index.html` — 不包含 `iframe` 标签
- `public/app.js` — `NativeBridge` 定义在引用之前；`sendImageData` 函数可被调用
- `public/style.css` — 所有 `@media` 块语法正确
- `AndroidManifest.xml` — 9 条新增权限均存在

- [ ] **Step 4: 最终提交**

```bash
cd C:\Users\hii24\chat-app
git commit --allow-empty -m "chore: verify mobile adaptation changes complete

Co-Authored-By: Claude <noreply@anthropic.com>"
```
