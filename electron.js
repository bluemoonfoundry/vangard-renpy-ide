

import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Window State Management ---
const windowStatePath = path.join(app.getPath('userData'), 'window-state.json');

async function loadWindowState() {
    try {
        const data = await fs.readFile(windowStatePath, 'utf-8');
        const state = JSON.parse(data);
        // Basic validation to ensure we have a usable state
        if (typeof state.width === 'number' && typeof state.height === 'number') {
            return state;
        }
    } catch (error) {
        // File doesn't exist or is invalid, which is expected on first launch.
        console.log('No saved window state found, using defaults.');
    }
    return null;
}

function saveWindowState(window) {
    if (!window) return;
    try {
        const bounds = window.getBounds();
        // Use fire-and-forget for writeFile as the app might be closing.
        fs.writeFile(windowStatePath, JSON.stringify(bounds));
    } catch (error) {
        console.error('Failed to save window state:', error);
    }
}
// --- End Window State Management ---


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
        // Sort children
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
        // No settings file found, which is fine.
        results.settings = {};
    }

    return results;
}


async function createWindow() {
  const savedState = await loadWindowState();

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: savedState?.width || 1280,
    height: savedState?.height || 800,
    x: savedState?.x,
    y: savedState?.y,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Security best practices are enabled by default in recent Electron versions:
      nodeIntegration: false,
      contextIsolation: true,
    },
    // The icon path should point to the icon file at the root of the app package.
    icon: path.join(__dirname, 'vangard-renide-512x512.png')
  });

  // Save the window state when the window is closed.
  mainWindow.on('close', () => {
    saveWindowState(mainWindow);
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

  // Load the index.html from the Vite build output directory.
  mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
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
      // fs.cp is recursive by default for directories
      await fs.cp(sourcePath, destPath, { recursive: true });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('path:join', (event, ...args) => {
    return path.join(...args);
  });


  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});