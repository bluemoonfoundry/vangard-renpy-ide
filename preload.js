const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  loadProject: (rootPath) => ipcRenderer.invoke('project:load', rootPath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  removeEntry: (entryPath) => ipcRenderer.invoke('fs:removeEntry', entryPath),
  moveFile: (oldPath, newPath) => ipcRenderer.invoke('fs:moveFile', oldPath, newPath),
  onMenuCommand: (callback) => {
    const subscription = (_event, ...args) => callback(...args);
    ipcRenderer.on('menu-command', subscription);

    return () => {
      ipcRenderer.removeListener('menu-command', subscription);
    };
  },
});
