import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { createTables, query, run, type SqlParams } from './database';

const isDev = !app.isPackaged;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

function registerIpcHandlers(): void {
  ipcMain.handle('app:get-version', () => app.getVersion());

  ipcMain.handle('app:open-external-link', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle('db:query', (_event, sql: string, params?: unknown[]) => {
    return query(sql, params as SqlParams | undefined);
  });

  ipcMain.handle('db:run', (_event, sql: string, params?: unknown[]) => {
    return run(sql, params as SqlParams | undefined);
  });
}

app.whenReady().then(() => {
  createTables();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
