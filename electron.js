




import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
                    const content = await fs.readFile(fullPath);
                    const dataUrl = `data:image/${path.extname(entry.name).slice(1)};base64,${content.toString('base64')}`;
                    const stats = await fs.stat(fullPath);
                    results.images.push({ path: relativePath, dataUrl, lastModified: stats.mtimeMs });
                } else if (/\.(mp3|ogg|wav|opus)$/i.test(entry.name)) {
                    const content = await fs.readFile(fullPath);
                    const dataUrl = `data:audio/${path.extname(entry.name).slice(1)};base64,${content.toString('base64')}`;
                    const stats = await fs.stat(fullPath);
                    results.audios.push({ path: relativePath, dataUrl, lastModified: stats.mtimeMs });
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

let forceQuit = false;

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
                click: () => mainWindow.webContents.send('menu-command', { command: 'new-project' })
            },
            { 
                label: 'Open Project...',
                accelerator: 'CmdOrCtrl+O',
                click: () => mainWindow.webContents.send('menu-command', { command: 'open-project' })
            },
            { type: 'separator' },
            {
                label: 'Run Project',
                accelerator: 'F5',
                click: () => mainWindow.webContents.send('menu-command', { command: 'run-project' })
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
              click: () => mainWindow.webContents.send('menu-command', { command: 'open-static-tab', type: 'canvas' })
            },
            { 
              label: 'Route Canvas',
              click: () => mainWindow.webContents.send('menu-command', { command: 'open-static-tab', type: 'route-canvas' })
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

  mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
}

app.whenReady().then(() => {
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
  
  ipcMain.handle('path:join', (event, ...args) => {
    return path.join(...args);
  });
  
  ipcMain.on('reply-unsaved-changes-before-exit', (event, hasUnsavedChanges) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        if (hasUnsavedChanges) {
            window.webContents.send('show-exit-modal');
        } else {
            forceQuit = true;
            app.quit();
        }
    }
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
      return await saveAppSettings(settings);
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