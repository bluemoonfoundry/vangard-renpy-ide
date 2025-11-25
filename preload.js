
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  createProject: () => ipcRenderer.invoke('dialog:createProject'),
  loadProject: (rootPath) => ipcRenderer.invoke('project:load', rootPath),
  writeFile: (filePath, content, encoding) => ipcRenderer.invoke('fs:writeFile', filePath, content, encoding),
  createDirectory: (dirPath) => ipcRenderer.invoke('fs:createDirectory', dirPath),
  removeEntry: (entryPath) => ipcRenderer.invoke('fs:removeEntry', entryPath),
  moveFile: (oldPath, newPath) => ipcRenderer.invoke('fs:moveFile', oldPath, newPath),
  copyEntry: (sourcePath, destPath) => ipcRenderer.invoke('fs:copyEntry', sourcePath, destPath),
  onMenuCommand: (callback) => {
    const subscription = (_event, ...args) => callback(...args);
    ipcRenderer.on('menu-command', subscription);

    return () => {
      ipcRenderer.removeListener('menu-command', subscription);
    };
  },
  path: {
    join: (...args) => ipcRenderer.invoke('path:join', ...args),
  }
});
