const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // 更新事件
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_, version) => callback(version)),

  // 平台信息
  platform: process.platform,
});
