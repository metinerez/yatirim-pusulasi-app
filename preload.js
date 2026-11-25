const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pusula', {
  load: () => ipcRenderer.invoke('load'),
  save: d => ipcRenderer.invoke('save', d),
  refresh: only => ipcRenderer.invoke('refresh', only),
  detail: index => ipcRenderer.invoke('detail', index),
  updateStatus: () => ipcRenderer.invoke('update-status'),
  updateInstall: () => ipcRenderer.invoke('update-install'),
  updateCheck: () => ipcRenderer.invoke('update-check'),
  onUpdate: cb => ipcRenderer.on('update', (e, d) => cb(d)),
  attachment: o => ipcRenderer.invoke('attachment', o),
  openFolder: () => ipcRenderer.invoke('open-folder'),
  pickBackupDir: () => ipcRenderer.invoke('pick-backup-dir'),
  backupNow: () => ipcRenderer.invoke('backup-now'),
  loginItem: on => ipcRenderer.invoke('login-item', on),
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
  version: () => ipcRenderer.invoke('version'),
  onData: cb => ipcRenderer.on('data', (e, d) => cb(d)),
  onRefresh: cb => ipcRenderer.on('refresh-state', (e, s) => cb(s))
});
