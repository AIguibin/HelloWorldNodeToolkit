const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 脚本管理
  getScripts: () => ipcRenderer.invoke('get-scripts'),
  saveScript: (scriptData) => ipcRenderer.invoke('save-script', scriptData),
  deleteScript: (name) => ipcRenderer.invoke('delete-script', name),
  
  // 脚本执行
  runScript: (scriptInfo) => ipcRenderer.invoke('run-script', scriptInfo),
  stopScript: () => ipcRenderer.invoke('stop-script'),
  
  // 文件操作
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  
  // 系统信息
  getTerminalInfo: () => ipcRenderer.invoke('get-terminal-info'),
  
  // 事件监听
  onScriptOutput: (callback) => {
    ipcRenderer.on('script-output', (event, data) => callback(data));
  },
  
  onOpenScriptsFolder: (callback) => {
    ipcRenderer.on('open-scripts-folder', () => callback());
  },
  
  onNewScript: (callback) => {
    ipcRenderer.on('new-script', () => callback());
  },
  
  // 移除监听器
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});