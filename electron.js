
import { app, BrowserWindow, ipcMain, dialog, Menu, protocol, net } from 'electron';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register custom protocol privileges BEFORE app is ready
protocol.registerSchemesAsPrivileged([
  { 
      scheme: 'media', 
      privileges: { 
          secure: true, 
          supportFetchAPI: true, 
          bypassCSP: true, 
          corsEnabled: true,
          stream: true,
          standard: true
      } 
  }
]);

// --- Game Process Management ---
let gameProcess = null;

// --- Window State Management ---
const windowStatePath = path.join(app.getPath('userData'), 'window-state.json');

async function loadWindowState() {
    try {
        const data = await fs.readFile(windowStatePath, 'utf-8');
        const state = JSON.parse(data);
        if (typeof state.width === 'number' && typeof state.height === 'number') {
            return state;
        }
    } catch (error) {
        console.log('No saved window state found, using defaults.');
    }
    return null;
}

function saveWindowState(window) {
    if (!window) return;
    try {
        const bounds = window.getBounds();
        fs.writeFile(windowStatePath, JSON.stringify(bounds));
    } catch (error) {
        console.error('Failed to save window state:', error);
    }
}

// --- App Settings Management ---
const appSettingsPath = path.join(app.getPath('userData'), 'app-settings.json');

async function loadAppSettings() {
    try {
        const data = await fs.readFile(appSettingsPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.log('No saved app settings found, using defaults.');
        return null;
    }
}

async function saveAppSettings(settings) {
    try {
        await fs.writeFile(appSettingsPath, JSON.stringify(settings, null, 2));
        return { success: true };
    } catch (error) {
        console.error('Failed to save app settings:', error);
        return { success: false, error: error.message };
    }
}


async function readProjectFiles(rootPath) {
    const results = {
        rootPath,
        files: [],
        images: [],
        audios: [],
        settings: null,
        tree: { name: path.basename(rootPath), path: '', children: [] }
    };

    const readDirRecursive = async (dirPath, treeNode) => {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const children = [];
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/');
            
            const childNode = { name: entry.name, path: relativePath, children: entry.isDirectory() ? [] : undefined };

            if (entry.isDirectory()) {
                await readDirRecursive(fullPath, childNode);
            } else if (entry.isFile()) {
                if (/\.(rpy)$/i.test(entry.name)) {
                    const content = await fs.readFile(fullPath, 'utf-8');
                    results.files.push({ path: relativePath, content });
                } else if (/\.(png|jpe?g|webp)$/i.test(entry.name)) {
                    const stats = await fs.stat(fullPath);
                    const mediaUrl = pathToFileURL(fullPath).toString().replace(/^file:/, 'media:');
                    results.images.push({ 
                        path: relativePath, 
                        dataUrl: mediaUrl, 
                        lastModified: stats.mtimeMs,
                        size: stats.size
                    });
                } else if (/\.(mp3|ogg|wav|opus)$/i.test(entry.name)) {
                    const stats = await fs.stat(fullPath);
                    const mediaUrl = pathToFileURL(fullPath).toString().replace(/^file:/, 'media:');
                    results.audios.push({ 
                        path: relativePath, 
                        dataUrl: mediaUrl, 
                        lastModified: stats.mtimeMs,
                        size: stats.size
                    });
                }
            }
            children.push(childNode);
        }
        children.sort((a, b) => {
            if (a.children && !b.children) return -1;
            if (!a.children && b.children) return 1;
            return a.name.localeCompare(b.name);
        });
        treeNode.children = children;
    };

    await readDirRecursive(rootPath, results.tree);
    
    try {
        const settingsContent = await fs.readFile(path.join(rootPath, 'game', 'project.ide.json'), 'utf-8');
        results.settings = JSON.parse(settingsContent);
    } catch (e) {
        results.settings = {};
    }

    return results;
}

async function scanDirectoryForAssets(dirPath) {
    const results = {
        images: [],
        audios: []
    };

    const scanRecursive = async (currentPath) => {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            // Normalize path separators to forward slashes for consistency in frontend
            const normalizedPath = fullPath.replace(/\\/g, '/');

            if (entry.isDirectory()) {
                await scanRecursive(fullPath);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
                    const stats = await fs.stat(fullPath);
                    const mediaUrl = pathToFileURL(fullPath).toString().replace(/^file:/, 'media:');
                    results.images.push({ 
                        path: normalizedPath, 
                        fileName: entry.name, 
                        dataUrl: mediaUrl, 
                        lastModified: stats.mtimeMs,
                        size: stats.size
                    });
                } else if (['.mp3', '.ogg', '.wav', '.opus'].includes(ext)) {
                    const stats = await fs.stat(fullPath);
                    const mediaUrl = pathToFileURL(fullPath).toString().replace(/^file:/, 'media:');
                    results.audios.push({ 
                        path: normalizedPath, 
                        fileName: entry.name, 
                        dataUrl: mediaUrl, 
                        lastModified: stats.mtimeMs,
                        size: stats.size
                    });
                }
            }
        }
    };

    await scanRecursive(dirPath);
    return results;
}

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.png': return 'image/png';
        case '.jpg': 
        case '.jpeg': return 'image/jpeg';
        case '.webp': return 'image/webp';
        case '.gif': return 'image/gif';
        case '.mp3': return 'audio/mpeg';
        case '.ogg': return 'audio/ogg';
        case '.wav': return 'audio/wav';
        case '.opus': return 'audio/opus';
        default: return 'application/octet-stream';
    }
}

let forceQuit = false;

async function updateApplicationMenu() {
  const settings = await loadAppSettings();
  const recentProjects = settings?.recentProjects || [];

  const openRecentSubmenu = recentProjects.length > 0
    ? recentProjects.map(p => ({
        label: p,
        click: (item, focusedWindow) => {
          if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'open-recent', path: p });
        }
      }))
    : [{ label: 'No Recent Projects', enabled: false }];

  const menuTemplate = [
    ...(process.platform === 'darwin' ? [{
        label: app.getName(),
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      }] : []),
    {
        label: 'File',
        submenu: [
            { 
                label: 'New Project...',
                accelerator: 'CmdOrCtrl+N',
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'new-project' }); }
            },
            { 
                label: 'Open Project...',
                accelerator: 'CmdOrCtrl+O',
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'open-project' }); }
            },
            {
                label: 'Open Recent',
                submenu: openRecentSubmenu
            },
            { type: 'separator' },
            {
                label: 'Run Project',
                accelerator: 'F5',
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'run-project' }); }
            },
            { type: 'separator' },
            process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }
        ]
    },
    {
        label: 'Edit',
        submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
        ]
    },
    {
        label: 'View',
        submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { 
              label: 'Story Canvas',
              click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'open-static-tab', type: 'canvas' }); }
            },
            { 
              label: 'Route Canvas',
              click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'open-static-tab', type: 'route-canvas' }); }
            },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' }
        ]
    },
    {
        role: 'window',
        submenu: [
            { role: 'minimize' },
            { role: 'zoom' },
        ]
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

async function createWindow() {
  const savedState = await loadWindowState();

  const mainWindow = new BrowserWindow({
    width: savedState?.width || 1280,
    height: savedState?.height || 800,
    x: savedState?.x,
    y: savedState?.y,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'vangard-renide-512x512.png')
  });

  mainWindow.on('close', (e) => {
    if (forceQuit) {
      saveWindowState(mainWindow);
      return;
    }
    e.preventDefault();
    mainWindow.webContents.send('check-unsaved-changes-before-exit');
  });

  await updateApplicationMenu();

  mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
}

async function searchInDirectory(directory, query, options) {
    const results = [];
    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        const relativePath = path.relative(options.projectPath, fullPath).replace(/\\/g, '/');
        
        if (entry.isDirectory()) {
            if (entry.name === '.git' || entry.name === 'node_modules') continue;
            results.push(...await searchInDirectory(fullPath, query, options));
        } else if (entry.isFile() && entry.name.endsWith('.rpy')) {
            const content = await fs.readFile(fullPath, 'utf-8');
            const lines = content.split('\n');
            const matches = [];
            
            let flags = 'g';
            if (!options.isCaseSensitive) flags += 'i';
            
            let searchPattern = options.isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (options.isWholeWord) {
                searchPattern = `\\b${searchPattern}\\b`;
            }

            try {
              const regex = new RegExp(searchPattern, flags);

              for (let i = 0; i < lines.length; i++) {
                  const line = lines[i];
                  let match;
                  while ((match = regex.exec(line)) !== null) {
                      matches.push({
                          lineNumber: i + 1,
                          lineContent: line,
                          startColumn: match.index + 1,
                          endColumn: match.index + match[0].length + 1,
                      });
                  }
              }
            } catch (e) {
              console.error(`Invalid regex for file ${relativePath}:`, e.message);
            }

            if (matches.length > 0) {
                results.push({ filePath: relativePath, matches });
            }
        }
    }
    return results;
}

app.whenReady().then(() => {
  // Robust 'media' protocol handler for serving local files with streaming support
  protocol.handle('media', async (request) => {
    try {
        const parsedUrl = new URL(request.url);
        let filePath;

        // On Windows, if scheme is standard, URL parser might move drive letter to hostname
        // e.g. media:///C:/path -> media://c:/path (hostname: c)
        if (process.platform === 'win32' && parsedUrl.hostname && parsedUrl.hostname.length === 1) {
             // Handle drive letters normalized as hostnames
             // Reconstruct as c:/pathname
             filePath = `${parsedUrl.hostname}:${decodeURIComponent(parsedUrl.pathname)}`;
        } else if (parsedUrl.hostname) {
            // UNC Path (Network share): //Server/Share/Path...
            // parsedUrl.pathname will be /Share/Path...
            // We reconstruct it as \\Server\Share\Path... or //Server/Share/Path...
            filePath = `//${parsedUrl.hostname}${decodeURIComponent(parsedUrl.pathname)}`;
        } else {
            // Standard path with empty hostname (media:///path)
            let pathPart = decodeURIComponent(parsedUrl.pathname);
            
            // On Windows, URLs from pathToFileURL look like /C:/path/to/file
            // We need to strip the leading slash to get C:/path/to/file
            if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(pathPart)) {
                pathPart = pathPart.substring(1);
            }
            filePath = pathPart;
        }
        
        // Use fs.stat to get size and createReadStream for streaming
        const stats = await fs.stat(filePath);
        const mimeType = getMimeType(filePath);
        
        // Convert Node stream to Web stream for Response
        const stream = createReadStream(filePath);
        const webStream = Readable.toWeb(stream);

        return new Response(webStream, {
            status: 200,
            headers: { 
                'Content-Type': mimeType,
                'Content-Length': stats.size
            }
        });
    } catch (e) {
        console.error('Media protocol error for URL:', request.url, e);
        return new Response('Not Found', { status: 404 });
    }
  });

  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    if (canceled) {
      return null;
    } else {
      return filePaths[0];
    }
  });

   ipcMain.handle('dialog:selectRenpy', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Select Ren\'Py Executable',
        properties: ['openFile'],
        filters: [
            { name: 'Ren\'Py Launcher', extensions: process.platform === 'win32' ? ['exe'] : ['sh'] },
        ]
    });
    if (canceled) {
        return null;
    } else {
        return filePaths[0];
    }
  });

  ipcMain.handle('dialog:createProject', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Create New Ren\'Py Project',
        buttonLabel: 'Create Project',
        defaultPath: path.join(app.getPath('documents'), 'NewRenPyProject')
    });
    if (canceled || !filePath) {
        return null;
    }
    try {
        await fs.mkdir(path.join(filePath, 'game', 'images'), { recursive: true });
        await fs.mkdir(path.join(filePath, 'game', 'audio'), { recursive: true });
        return filePath;
    } catch (error) {
        console.error('Failed to create project directory:', error);
        dialog.showErrorBox('Project Creation Failed', `Could not create project directory: ${error.message}`);
        return null;
    }
  });

  ipcMain.handle('dialog:showSaveDialog', async (event, options) => {
    const { canceled, filePath } = await dialog.showSaveDialog(options);
    if (canceled) return null;
    return filePath;
  });

  ipcMain.handle('project:load', async (event, rootPath) => {
    return await readProjectFiles(rootPath);
  });

  ipcMain.handle('fs:writeFile', async (event, filePath, content, encoding) => {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, encoding);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fs:createDirectory', async (event, dirPath) => {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fs:removeEntry', async (event, entryPath) => {
    try {
      await fs.rm(entryPath, { recursive: true, force: true });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fs:moveFile', async (event, oldPath, newPath) => {
    try {
      await fs.mkdir(path.dirname(newPath), { recursive: true });
      await fs.rename(oldPath, newPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fs:copyEntry', async (event, sourcePath, destPath) => {
    try {
      await fs.cp(sourcePath, destPath, { recursive: true });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('fs:scanDirectory', async (event, dirPath) => {
      try {
          return await scanDirectoryForAssets(dirPath);
      } catch (error) {
          console.error("Scan directory failed:", error);
          return { images: [], audios: [] };
      }
  });
  
  ipcMain.handle('path:join', (event, ...args) => {
    return path.join(...args);
  });
  
  ipcMain.on('reply-unsaved-changes-before-exit', (event, hasUnsavedChanges) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        if (hasUnsavedChanges) {
            window.webContents.send('show-exit-modal');
        } else {
            window.webContents.send('save-ide-state-before-quit');
        }
    }
  });

  ipcMain.on('ide-state-saved-for-quit', () => {
    forceQuit = true;
    app.quit();
  });

  ipcMain.on('force-quit', () => {
    forceQuit = true;
    app.quit();
  });

  ipcMain.on('game:run', (event, renpyPath, projectPath) => {
    if (gameProcess) {
      console.log('Game is already running.');
      return;
    }

    try {
      gameProcess = spawn(renpyPath, [projectPath]);
      event.sender.send('game-started');

      gameProcess.on('close', (code) => {
        console.log(`Game process exited with code ${code}`);
        gameProcess = null;
        event.sender.send('game-stopped');
      });

      gameProcess.on('error', (err) => {
        console.error('Failed to start game process:', err);
        event.sender.send('game-error', err.message);
        gameProcess = null;
      });

    } catch (err) {
      console.error('Spawn error:', err);
      event.sender.send('game-error', err.message);
      gameProcess = null;
    }
  });

  ipcMain.on('game:stop', () => {
    if (gameProcess) {
      gameProcess.kill();
      gameProcess = null;
    }
  });

  ipcMain.handle('app:get-settings', async () => {
    return await loadAppSettings();
  });
  
  ipcMain.handle('app:save-settings', async (event, settings) => {
      const result = await saveAppSettings(settings);
      if (result.success) {
          await updateApplicationMenu();
      }
      return result;
  });

  ipcMain.handle('project:search', async (event, { projectPath, query, ...options }) => {
    if (!query) return [];
    try {
        const results = await searchInDirectory(projectPath, query, { projectPath, ...options });
        return results;
    } catch (error) {
        console.error('Search failed:', error);
        return [];
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (gameProcess) {
    gameProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
