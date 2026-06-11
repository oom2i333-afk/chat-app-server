const { app, BrowserWindow, Tray, Menu, nativeImage, Notification, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// ─── 配置 ───────────────────────────────────────────────
// 部署到 Railway 后改成你的域名
const SERVER_URL = process.env.CHAT_SERVER_URL || 'http://localhost:3000';
const APP_NAME = 'Chat App';

let mainWindow = null;
let tray = null;
let isQuitting = false;

// ─── 创建主窗口 ─────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 680,
    minHeight: 480,
    title: APP_NAME,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    frame: true,
    titleBarStyle: 'default',
    backgroundColor: '#2e2e2e',
    show: false,
  });

  // 加载服务器页面
  mainWindow.loadURL(SERVER_URL);

  // 显示窗口（避免白屏闪烁）
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // ─── 检查更新 ──────────────────────────────────────────
  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = false;
  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-available', info.version);
  });

  // ─── 通知支持 ──────────────────────────────────────────
  mainWindow.webContents.on('notification', (event, title, body) => {
    event.preventDefault();
    const notification = new Notification({ title, body, icon: path.join(__dirname, 'icon.png') });
    notification.onclick = () => {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    };
    notification.show();
  });

  // ─── 外部链接 ──────────────────────────────────────────
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // ─── 关闭事件 ──────────────────────────────────────────
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// ─── 系统托盘 ───────────────────────────────────────────
function createTray() {
  // 用文字图标
  const icon = nativeImage.createFromBuffer(Buffer.alloc(0));
  tray = new Tray(icon);
  tray.setToolTip(APP_NAME);

  const contextMenu = Menu.buildFromTemplate([
    { label: '打开 Chat App', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    {
      label: '退出', click: () => {
        isQuitting = true;
        app.quit();
      }
    },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

// ─── 应用菜单 ───────────────────────────────────────────
function createMenu() {
  const template = [
    {
      label: APP_NAME,
      submenu: [
        { label: '关于 Chat App', role: 'about' },
        { type: 'separator' },
        { label: '隐藏', role: 'hide' },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => { isQuitting = true; app.quit(); } },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', role: 'reload' },
        { label: '开发者工具', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { label: '重置缩放', role: 'resetZoom' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize' },
        { label: '关闭', role: 'close' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ─── 应用生命周期 ───────────────────────────────────────
app.whenReady().then(() => {
  createMenu();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else { mainWindow.show(); mainWindow.focus(); }
  });
});

app.on('before-quit', () => { isQuitting = true; });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── 单实例锁 ───────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
