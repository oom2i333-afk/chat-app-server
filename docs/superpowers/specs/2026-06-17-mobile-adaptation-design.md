# WeTalk 移动端适配方案

> 日期: 2026-06-17
> 状态: 待实现
> 项目: chat-app

## 1. 目标

解决 WeTalk Capacitor 移动端两个核心问题：
1. **打字不方便** — 键盘弹出时布局错位、输入区域偏小
2. **权限获取失败** — 无法调用相机、麦克风、文件读写等原生能力

## 2. 架构改造

### 2.1 现状问题

Capacitor `mobile/src/index.html` 用 iframe 加载远程服务器 URL，导致：
- `window.Capacitor` 桥接对象在 iframe 跨域环境下不可用
- 即使安装原生插件，Web 应用也无法调用
- 键盘事件无法正确传递到 Capacitor 的 Keyboard 插件
- 双层渲染造成性能浪费

### 2.2 改进方案

移除 iframe，利用 Capacitor 的 `server.url` 配置让 WebView **直接加载**远程 URL。

```
改造前:
  Capacitor App Shell → src/index.html (iframe) → 远程服务器 (web app)

改造后:
  Capacitor App Shell → 远程服务器 (web app) [WebView 直连]
```

具体改动：
- `mobile/src/index.html` — 移除 iframe，改为纯 Splash/加载过渡页（ProgressBar + 品牌展示），WebView 直接加载 `server.url`
- `mobile/capacitor.config.json` — 保持 `server.url` 配置（已存在）
- 利用 Capacitor 内置的 `SplashScreen` 插件管理启动画面

### 2.3 安全性

- Android `allowMixedContent: false` — 不允许 HTTP 混合内容
- `cleartext: false` — 不发送明文 HTTP 请求
- WebApp 通过 HTTPS 加载，确保 Capacitor 桥接安全注入

## 3. Capacitor 原生插件

### 3.1 新增依赖

```json
{
  "dependencies": {
    "@capacitor/camera": "^7.0.0",
    "@capacitor/filesystem": "^7.0.0",
    "@capacitor/device": "^7.0.0",
    "@capacitor/keyboard": "^7.0.0",
    "@capacitor/network": "^7.0.0"
  }
}
```

### 3.2 插件用途

| 插件 | 主用途 | 备用方案 |
|------|--------|---------|
| Camera | 拍照/相册选图 | 检测不可用时降级 `<input type="file">` |
| Filesystem | 读取文件二进制 | 降级 FileReader |
| Keyboard | 监听键盘弹出/收起，调整布局 | 默认 `resize: "body"` |
| Device | 获取设备型号 / iOS/Android 判断 | — |
| Network | 网络状态监听 | 已有 `window.addEventListener('online')` |

### 3.3 Capacitor 桥接层

在 `public/app.js` 中添加统一的 `NativeBridge` 工具对象：

```js
const NativeBridge = {
  get isAvailable() { return typeof window.Capacitor !== 'undefined'; },
  get platform() { return this.isAvailable ? Capacitor.getPlatform() : 'web'; },

  async pickImage() {
    if (this.isAvailable) {
      // 通过 window.Capacitor.Plugins.Camera 调用
      const Camera = Capacitor.Plugins.Camera;
      const image = await Camera.pickImages({ quality: 80, limit: 1 });
      return image.dataUrls[0];
    }
    // 降级为浏览器 file input
    return fallbackPickImage();
  },

  async startRecording() {
    if (this.isAvailable) {
      // 使用 Capacitor 麦克风
    }
    return navigator.mediaDevices.getUserMedia({ audio: true });
  },

  onKeyboardShow(callback) {
    if (this.isAvailable) {
      Keyboard.addListener('keyboardWillShow', (info) => callback(info.keyboardHeight));
    }
  }
};
```

Web App 中原有使用浏览器 API 的地方（图片选择、录音、文件上传），全部改为先尝试 `NativeBridge.xxx()`，不可用时自动降级。

## 4. Android 权限声明

`mobile/android/app/src/main/AndroidManifest.xml` 添加：

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- Android 13+ 细粒度媒体权限 -->
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
<!-- Android 12- 兼容 -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />
```

## 5. 移动端 UI 适配

### 5.1 输入区重设计（高优先级）

```css
/* <768px 移动端输入区改进 */
@media (max-width: 768px) {
  .input-area {
    padding: .45rem .5rem;
    /* 安全区域底部 */
    padding-bottom: calc(.45rem + env(safe-area-inset-bottom, 0));
  }
  .input-wrapper input {
    font-size: 1rem;    /* 防止 iOS 缩放 */
    padding: .55rem .85rem;
    min-height: 40px;
  }
  .input-action-btn {
    width: 38px;
    height: 38px;
    font-size: 1.15rem;
  }
  .send-btn {
    padding: .35rem .75rem;
    font-size: .88rem;
    min-height: 36px;
  }
  /* 键盘弹出时 Messages 容器压缩 */
  .messages-container.keyboard-open {
    /* 由 JS 动态设置 padding-bottom */
  }
  /* 图片/语音按钮隐藏部分，让输入框更大 */
  #redpacketBtn, #emojiBtn {
    display: none;  /* 可通过 "+" 展开菜单访问 */
  }
}
```

### 5.2 聊天列表触控优化

```css
@media (max-width: 768px) {
  .chat-item, .contact-item {
    padding: .7rem .8rem;
    min-height: 60px;
  }
  .chat-item .avatar, .contact-item .avatar {
    width: 44px; height: 44px;
  }
  .chat-item .chat-info .chat-name {
    font-size: .9rem;
  }
  .chat-item .chat-info .chat-preview {
    font-size: .8rem;
  }
}
```

### 5.3 聊天窗口全屏优化

- 当前 `chat-window` 在 `<768px` 时 `position: fixed; inset: 0; z-index: 100`
- 完善返回按钮（`mobile-back`）的过渡动画
- 聊天头部增加安全区域适配

### 5.4 登录/注册页优化

```css
@media (max-width: 768px) {
  .login-card {
    width: 100%;
    padding: 1.2rem 1rem;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
    min-height: 100vh;
    justify-content: center;
  }
  .input-group input {
    font-size: 1rem;
    padding: .7rem .8rem;
  }
}
```

### 5.5 暗色模式/管理后台

本次不改，已有暗色模式支持。

## 6. 受影响的文件清单

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `mobile/src/index.html` | 重写 | 移除 iframe，改为 Splash 过渡页 |
| `mobile/package.json` | 修改 | 添加 Capacitor 插件依赖 |
| `mobile/capacitor.config.json` | 检查/微调 | 确认 server.url 配置正确 |
| `mobile/android/app/src/main/AndroidManifest.xml` | 新增 | 权限声明（需先 cap sync 生成） |
| `mobile/android/app/src/main/res/xml/network_security_config.xml` | 检查 | HTTPS 配置 |
| `public/app.js` | 修改 | 添加 NativeBridge 桥接层 |
| `public/style.css` | 修改 | 移动端 UI 适配样式 |
| `public/index.html` | 不动 | 已有 viewport meta，无需改 |
| `public/webrtc.js` | 检查 | 通话界面移动端适配 |
| `public/webrtc.css` | 可能改 | 通话按钮/界面移动端尺寸 |

## 7. 实施顺序

1. **Phase A: 基础设施** — 安装插件、配置权限、修改 src/index.html
2. **Phase B: UI 适配** — CSS 媒体查询、输入区重设计、键盘适配
3. **Phase C: 原生桥接** — NativeBridge 工具层、图片/录音/文件走 Capacitor 插件
4. **Phase D: 验证与修补** — 真机或模拟器测试、修复兼容性问题

## 8. 回退方案

- 如果 Capacitor 插件在某些机型上不工作，`NativeBridge` 自动降级为浏览器 API
- 原始 iframe 方案保留在 git 历史中，可通过 `git revert` 恢复
- `mobile/src/index.html` 的 iframe 代码保留注释，紧急时可快速切回

## 9. 未涵盖范围

- 端到端加密（独立功能）
- 文件传输扩展（后续迭代）
- 桌面端 Electron 改动（本次仅移动端）
