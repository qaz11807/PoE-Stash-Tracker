import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import {
  createTables,
  getLeagues,
  getSnapshots,
  getStashItems,
  insertLeague,
  insertSnapshot,
  insertStashItem,
  type NewStashItem
} from './database';

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
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return;
      }

      await shell.openExternal(url);
    } catch {
      return;
    }
  });

  ipcMain.handle('db:getLeagues', () => {
    return getLeagues();
  });

  ipcMain.handle('db:insertLeague', (_event, name: string) => {
    return insertLeague(name);
  });

  ipcMain.handle('db:getSnapshots', (_event, leagueId: number) => {
    return getSnapshots(leagueId);
  });

  ipcMain.handle('db:insertSnapshot', (_event, leagueId: number, rawJson: string) => {
    return insertSnapshot(leagueId, rawJson);
  });

  ipcMain.handle('db:getStashItems', (_event, snapshotId: number) => {
    return getStashItems(snapshotId);
  });

  ipcMain.handle('db:insertStashItem', (_event, data: NewStashItem) => {
    return insertStashItem(data);
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
