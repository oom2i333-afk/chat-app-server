# WeTalk 四项新功能设计规格

> 日期: 2026-06-17
> 状态: 待实现
> 项目: chat-app

---

## 1. 文件传输（含视频）

### 1.1 消息结构

```json
{
  "id": "msg_xxx",
  "from": "user_xxx",
  "to": "user_xxx",
  "type": "file",
  "fileName": "report.pdf",
  "fileSize": 1024000,
  "mimeType": "application/pdf",
  "fileUrl": "/uploads/files/file_xxx.pdf",
  "time": 1718612345678,
  "status": "sent",
  "readAt": null
}
```

### 1.2 服务端

- 新增 socket 事件 `send-file`，通道：base64 dataUrl（类似 `send-image`）
- 文件存入 `uploads/files/` 目录
- 大小限制 50MB
- 支持的 MIME 类型前缀：`image/`, `video/`, `audio/`, `application/pdf`, `application/msword`, `application/vnd.*`, `text/`, `application/zip`, `application/x-rar*`
- 群聊/单聊复用现有消息广播机制

### 1.3 前端

- 输入区新增文件按钮（📎 图标），放在图片按钮旁
- 文件选择器 accept 不限类型（`<input type="file">`）
- 文件消息气泡渲染：左图标 + 文件名 + 文件大小（底部时间）
- 图标映射：`pdf`→📄, `word`→📝, `excel`→📊, `zip`→📦, `video`→🎬, `audio`→🎵, 其他→📎
- 可预览类型（image/video/audio）点击后预览/播放
- 不可预览类型点击下载
- 进度指示器（上传中 → 完成）

### 1.4 样式

- 文件气泡：flex 左图标 40x40 + 右文字信息
- 文件名：加粗，单行省略
- 文件大小：灰色 12px
- 下载按钮：hover 时显示

---

## 2. 群@提及

### 2.1 服务端

- `send-message` 处理时解析 `text` 字段：
  - 正则匹配 `@([^\s]+)` 模式
  - 提取被 @ 用户名列表 → 映射为 userId 列表
  - 消息附加 `mentionedUserIds: [id1, id2]` 字段
  - `@all` 特殊处理 → 包含所有群成员
- 广播 `new-message` 时包含 `mentionedUserIds`
- 被 @ 用户收到标记（前端处理高亮）

### 2.2 前端

**输入：**
- 群聊输入框监听 `input`/`keydown`，识别 `@` 字符
- 输入 `@` 后弹出成员下拉列表（过滤匹配输入文字）
- 选择成员后插入 `@用户名 ` 文本
- 支持连续 @ 多个成员

**展示：**
- 消息气泡中 `@用户名` 文本用蓝色高亮显示（`<span class="mention">@用户名</span>`）
- 当前用户被 @ 时，聊天列表中该聊天显示 @ 标记（红色徽标）
- 进入聊天时自动滚动到被 @ 消息位置

**数据流：**
- 发送时 `text` 保留 `@用户名` 原文
- 前端渲染时用正则替换 `@用户名` → 高亮 span
- `escapeHtml` 之后做替换

---

## 3. 消息回应 (Reactions)

### 3.1 消息结构

消息对象新增字段：
```json
{
  "reactions": [
    { "userId": "user_xxx", "emoji": "👍" },
    { "userId": "user_yyy", "emoji": "❤️" }
  ]
}
```

### 3.2 服务端

- 新增 `react-to-message({ messageId, chatId, emoji })`：
  - 查找消息，检查用户是否已回应相同 emoji → 取消（toggle）
  - 检查用户是否已回应不同 emoji → 切换
  - 否则新增
  - 广播 `message-reacted({ messageId, chatId, reactions })`
- 消息持久化时保留 reactions 数组

### 3.3 前端

**反应选择：**
- 长按消息气泡（>500ms）弹出反应面板
- 5 个表情：👍 ❤️ 😄 😢 😡
- 面板显示在气泡上方，跟随手指位置
- 点击表情后发送 `react-to-message`，面板关闭

**反应显示：**
- 消息气泡右下角显示 reaction 气泡（紧凑排列）
- 每个 reaction 显示：emoji + 计数（>1时）
- 当前用户已选的 emoji 半透明高亮
- 多个反应按 emoji 类型聚合显示

**取消：**
- 点击已有 reaction 气泡中自己的 emoji → 取消
- 长按自己的 emoji → 取消

---

## 4. 移动端完善

### 4.1 推送通知

**后端配置：**
- 使用 `web-push` 库（已有依赖 `web-push`）
- 新增 `POST /api/push/register` 注册设备 token（已有路由骨架）
- 离线时存储待推送消息
- 消息发送时检测接收方在线状态，不在线则推送通知

**前端 App (Capacitor)：**
- 使用 `PushNotifications` 插件注册和设备获取 token
- 调用 `POST /api/push/register` 发送 token 到服务器
- 接收推送时显示本地通知

**前端 Web (PWA)：**
- 已有 Service Worker（`sw.js`）
- 在 SW 中监听 `push` 事件 → 显示 Notification

### 4.2 扫码加好友/进群

**设计选择：** 用 `qrcode` npm 包生成二维码，用 Capacitor 的 `Camera` 插件扫码

**后端：**
- 新增 `GET /api/user/qrcode/:userId` → 返回用户二维码 SVG/PNG
- 二维码内容：`wetalk://user/{userId}` 或 `wetalk://group/{groupId}`
- 新增 `POST /api/qrcode/scan` → 解析二维码内容，执行加好友/加群操作

**前端 UI：**
- 个人资料页新增"我的二维码"按钮
- 群组信息页新增群二维码
- 扫码入口：侧栏/通讯录页扫码按钮
- 使用 Capacitor `Camera` 插件扫码 → 发送到解析接口

### 4.3 手势返回

**实现：**
- 在 `chat-window` 上监听 touch 事件
- 右滑时跟随手指移动 `chat-window` 的 translateX
- 超过阈值（屏幕宽度 30%）→ 完成关闭动画 → 执行 `mobileBack.click()`
- 否则回弹到原位
- 只对移动端生效（`<768px`）

**样式：**
- 滑动时添加阴影遮罩覆盖侧栏
- 动画使用 transform（GPU 加速）保证流畅

---

## 5. 实施顺序

1. **Phase A:** 文件传输 — 扩展 send-image 为新 send-file
2. **Phase B:** 群@提及 — 输入框 @ 选择 + 服务端解析 + 高亮渲染
3. **Phase C:** 消息回应 — 长按反应面板 + reactions 存储展示
4. **Phase D:** 移动端完善 — 推送通知 + 扫码 + 手势返回

## 6. 涉及文件

| 文件 | 改动 |
|------|------|
| `server.js` | 新增 `send-file` 事件；修改 `send-message` 解析 @；新增 `react-to-message` 事件；推送通知服务；扫码 API |
| `public/app.js` | 文件选择器、文件气泡渲染、@选择器、反应面板、推送注册、手势返回 |
| `public/style.css` | 文件气泡、反应面板、@高亮、手势返回动画 |
| `public/index.html` | 文件按钮、扫码入口 |
| `mobile/src/index.html` | 无改动 |
| `mobile/package.json` | 添加 `qrcode` 依赖（若需服务端生成二维码） |
