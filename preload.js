
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  createProject: () => ipcRenderer.invoke('dialog:createProject'),
  loadProject: (rootPath) => ipcRenderer.invoke('project:load', rootPath),
  // FIX: Pass the encoding parameter to the main process for correct file writing.
  writeFile: (filePath, content, encoding) => ipcRenderer.invoke('fs:writeFile', filePath, content, encoding),
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