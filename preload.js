const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getStartupArgs: () => ipcRenderer.invoke('app:get-startup-args'),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  createProject: () => ipcRenderer.invoke('dialog:createProject'),
  createProjectFromTemplate: (options) => ipcRenderer.invoke('dialog:createProjectFromTemplate', options),
  checkRenpyProject: (rootPath) => ipcRenderer.invoke('dialog:checkRenpyProject', rootPath),
  cancelProjectLoad: () => ipcRenderer.send('project:cancel-load'),
  onLoadProgress: (callback) => {
    const handler = (_event, value, message) => callback(value, message);
    ipcRenderer.on('project:load-progress', handler);
    return () => ipcRenderer.removeListener('project:load-progress', handler);
  },
  loadProject: (rootPath) => ipcRenderer.invoke('project:load', rootPath),
  refreshProjectTree: (rootPath) => ipcRenderer.invoke('project:refresh-tree', rootPath),
  refreshProject: (rootPath) => ipcRenderer.invoke('project:refresh', rootPath),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  fileExists: (filePath) => ipcRenderer.invoke('fs:fileExists', filePath),
  writeFile: (filePath, content, encoding) => ipcRenderer.invoke('fs:writeFile', filePath, content, encoding),
  createDirectory: (dirPath) => ipcRenderer.invoke('fs:createDirectory', dirPath),
  removeEntry: (entryPath) => ipcRenderer.invoke('fs:removeEntry', entryPath),
  moveFile: (oldPath, newPath) => ipcRenderer.invoke('fs:moveFile', oldPath, newPath),
  copyEntry: (sourcePath, destPath) => ipcRenderer.invoke('fs:copyEntry', sourcePath, destPath),
  importPortraitImage: (sourcePath) => ipcRenderer.invoke('fs:importPortraitImage', sourcePath),
  scanDirectory: (dirPath) => ipcRenderer.invoke('fs:scanDirectory', dirPath),
  cancelScanDirectory: () => ipcRenderer.send('fs:cancel-scan-directory'),
  onScanProgress: (callback) => {
    const handler = (_event, count) => callback(count);
    ipcRenderer.on('fs:scan-progress', handler);
    return () => ipcRenderer.removeListener('fs:scan-progress', handler);
  },
  onMenuCommand: (callback) => {
    const subscription = (_event, ...args) => callback(...args);
    ipcRenderer.on('menu-command', subscription);

    return () => {
      ipcRenderer.removeListener('menu-command', subscription);
    };
  },
  // --- Exit confirmation flow ---
  onCheckUnsavedChangesBeforeExit: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('check-unsaved-changes-before-exit', subscription);
    return () => ipcRenderer.removeListener('check-unsaved-changes-before-exit', subscription);
  },
  replyUnsavedChangesBeforeExit: (hasUnsaved) => {
    ipcRenderer.send('reply-unsaved-changes-before-exit', hasUnsaved);
  },
  onShowExitModal: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('show-exit-modal', subscription);
    return () => ipcRenderer.removeListener('show-exit-modal', subscription);
  },
  onSaveIdeStateBeforeQuit: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('save-ide-state-before-quit', subscription);
    return () => ipcRenderer.removeListener('save-ide-state-before-quit', subscription);
  },
  ideStateSavedForQuit: () => {
    ipcRenderer.send('ide-state-saved-for-quit');
  },
  forceQuit: () => {
    ipcRenderer.send('force-quit');
  },
  // --- Game Execution ---
  selectRenpy: () => ipcRenderer.invoke('dialog:selectRenpy'),
  selectImage: () => ipcRenderer.invoke('dialog:selectImage'),
  runGame: (renpyPath, projectPath, warpTarget) => ipcRenderer.send('game:run', renpyPath, projectPath, warpTarget),
  stopGame: () => ipcRenderer.send('game:stop'),
  checkRenpyPath: (path) => ipcRenderer.invoke('renpy:check-path', path),
  generateTranslations: (sdkDir, projectPath, language) => ipcRenderer.invoke('renpy:generate-translations', sdkDir, projectPath, language),
  onGameStarted: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('game-started', subscription);
    return () => ipcRenderer.removeListener('game-started', subscription);
  },
  onGameStopped: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('game-stopped', subscription);
    return () => ipcRenderer.removeListener('game-stopped', subscription);
  },
  onGameError: (callback) => {
    const subscription = (_event, error) => callback(error);
    ipcRenderer.on('game-error', subscription);
    return () => ipcRenderer.removeListener('game-error', subscription);
  },
  onGameCrashLog: (callback) => {
    const subscription = (_event, tracebackText) => callback(tracebackText);
    ipcRenderer.on('game-crash-log', subscription);
    return () => ipcRenderer.removeListener('game-crash-log', subscription);
  },
  // --- App Settings ---
  getAppSettings: () => ipcRenderer.invoke('app:get-settings'),
  saveAppSettings: (settings) => ipcRenderer.invoke('app:save-settings', settings),
  getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),
  // --- Path utils ---
  path: {
    join: (...args) => ipcRenderer.invoke('path:join', ...args),
  },
  webUtils: {
    getPathForFile: (file) => webUtils.getPathForFile(file),
  },
  // --- Search ---
  searchInProject: (options) => ipcRenderer.invoke('project:search', options),
  cancelSearch: () => ipcRenderer.send('project:cancel-search'),
  onSearchProgress: (callback) => {
    const handler = (_event, count) => callback(count);
    ipcRenderer.on('project:search-progress', handler);
    return () => ipcRenderer.removeListener('project:search-progress', handler);
  },
  // --- Dialogs ---
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSaveDialog', options),
  // --- Snippet pack import/export ---
  readUserGlobalSnippets: () => ipcRenderer.invoke('snippets:readUserGlobal'),
  writeUserGlobalSnippets: (content) => ipcRenderer.invoke('snippets:writeUserGlobal', content),
  exportSnippetPack: (suggestedFileName, content) => ipcRenderer.invoke('snippets:exportPack', suggestedFileName, content),
  importSnippetPack: () => ipcRenderer.invoke('snippets:importPack'),
  // --- Secure API key access ---
  loadApiKeys: () => ipcRenderer.invoke('app:load-api-keys'),
  saveApiKey: (provider, key) => ipcRenderer.invoke('app:save-api-key', provider, key),
  getApiKey: (provider) => ipcRenderer.invoke('app:get-api-key', provider),
  // --- Auto-updater ---
  onUpdateAvailable: (callback) => {
    const subscription = (_event, version) => callback(version);
    ipcRenderer.on('update-available', subscription);
    return () => ipcRenderer.removeListener('update-available', subscription);
  },
  onUpdateNotAvailable: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('update-not-available', subscription);
    return () => ipcRenderer.removeListener('update-not-available', subscription);
  },
  onUpdateError: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('update-error', subscription);
    return () => ipcRenderer.removeListener('update-error', subscription);
  },
  onUpdateDownloaded: (callback) => {
    const subscription = (_event, version) => callback(version);
    ipcRenderer.on('update-downloaded', subscription);
    return () => ipcRenderer.removeListener('update-downloaded', subscription);
  },
  installUpdate: () => ipcRenderer.send('install-update'),
  // --- Explorer menu state ---
  updateExplorerMenuState: (state) => ipcRenderer.send('explorer:update-menu-state', state),
  // --- Shell ---
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  showItemInFolder: (filePath) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
  // --- External file change notifications ---
  onFileChangedExternally: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('fs:file-changed-externally', subscription);
    return () => ipcRenderer.removeListener('fs:file-changed-externally', subscription);
  },
  onWatcherError: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('fs:watcher-error', subscription);
    return () => ipcRenderer.removeListener('fs:watcher-error', subscription);
  },
  onSettingsWarning: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('app:settings-warning', subscription);
    return () => ipcRenderer.removeListener('app:settings-warning', subscription);
  },
  // --- Logging ---
  log: (level, ...args) => ipcRenderer.send('app:log', level, ...args),
  getLogPath: () => ipcRenderer.invoke('app:get-log-path'),
  openLogDirectory: () => ipcRenderer.invoke('app:open-log-directory'),
  // --- Screenshots ---
  captureScreenshot: () => ipcRenderer.invoke('app:capture-screenshot'),
  getScreenshotCount: () => ipcRenderer.invoke('app:get-screenshot-count'),
  openScreenshotsFolder: () => ipcRenderer.invoke('app:open-screenshots-folder'),
  clearScreenshots: () => ipcRenderer.invoke('app:clear-screenshots'),
  getLatestScreenshotPath: () => ipcRenderer.invoke('app:get-latest-screenshot-path'),
  onScreenshotCaptured: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('screenshot-captured', handler);
    return () => ipcRenderer.removeListener('screenshot-captured', handler);
  },
  // --- Detachable tab windows ---
  popoutTab: (tabId, tabType) => ipcRenderer.invoke('window:popout-tab', { tabId, tabType }),
  focusMainWindow: () => ipcRenderer.send('window:focus-main'),
  closePopoutSelf: () => ipcRenderer.send('popout:close-self'),
  onTabRedocked: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('window:tab-redocked', handler);
    return () => ipcRenderer.removeListener('window:tab-redocked', handler);
  },
  callPopoutHandler: (tabId, handlerName, args) => ipcRenderer.invoke('popout:call-handler', { tabId, handlerName, args }),
  onPopoutInvokeHandler: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('popout:invoke-handler', handler);
    return () => ipcRenderer.removeListener('popout:invoke-handler', handler);
  },
  replyPopoutHandlerResult: (requestId, result, error) => {
    ipcRenderer.send('popout:handler-result', { requestId, result, error });
  },
  sendPopoutStateUpdate: (tabId, snapshot) => ipcRenderer.send('popout:state-update', { tabId, snapshot }),
  onPopoutPropsUpdate: (callback) => {
    const handler = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on('popout:props-update', handler);
    return () => ipcRenderer.removeListener('popout:props-update', handler);
  },
  requestPopoutSnapshot: (tabId) => ipcRenderer.send('popout:request-snapshot', { tabId }),
  onPopoutSnapshotRequested: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('popout:snapshot-requested', handler);
    return () => ipcRenderer.removeListener('popout:snapshot-requested', handler);
  },
  onPopoutFlushRequested: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('popout:flush-requested', handler);
    return () => ipcRenderer.removeListener('popout:flush-requested', handler);
  },
  acknowledgePopoutFlush: () => ipcRenderer.send('popout:flush-complete'),
  flushAllPopouts: () => ipcRenderer.invoke('window:flush-all-popouts'),
  closeAllPopouts: () => ipcRenderer.invoke('window:close-all-popouts'),
  closePopoutForTab: (tabId) => ipcRenderer.invoke('window:close-popout-for-tab', { tabId }),
});
