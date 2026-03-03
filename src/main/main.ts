import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { handlePoeOAuthCallback, registerPoeIpcHandlers } from './ipc-handlers/poe';
import {
  createTables,
  getLeagues,
  getSnapshots,
  getSnapshotsWithItemCounts,
  getSnapshotDetail,
  getStashItems,
  getSnapshotItemCount,
  insertLeague,
  insertSnapshot,
  insertStashItem,
  insertStashItemsBatch,
  type NewStashItem
} from './database';

const isDev = !app.isPackaged;
const CUSTOM_PROTOCOL = 'poestashtracker';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

function registerCustomProtocolHandler(): void {
  let registered = false;
  if (process.defaultApp) {
    registered = app.setAsDefaultProtocolClient(CUSTOM_PROTOCOL, process.execPath, [path.resolve(process.argv[1] ?? '')]);
  } else {
    registered = app.setAsDefaultProtocolClient(CUSTOM_PROTOCOL);
  }
  if (!registered) {
    console.warn('[main] Failed to register protocol handler');
  }
}

function extractDeepLink(argv: string[]): string | null {
  return argv.find((arg) => arg.startsWith(`${CUSTOM_PROTOCOL}://`)) ?? null;
}

function isValidOAuthCallbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'poestashtracker:' && parsed.hostname === 'oauth' && parsed.pathname.startsWith('/callback');
  } catch {
    return false;
  }
}

async function tryHandleOAuthCallback(url: string | null): Promise<void> {
  if (!url) return;

  if (!isValidOAuthCallbackUrl(url)) {
    console.warn('[main] Ignoring invalid OAuth callback URL', url);
    mainWindow?.webContents.send('poe:oauth-callback-error', 'Invalid OAuth callback URL');
    return;
  }

  const success = await handlePoeOAuthCallback(url);
  if (!success) {
    console.warn('[main] OAuth callback was not handled (state mismatch or no pending auth)');
    mainWindow?.webContents.send('poe:oauth-callback-error', 'OAuth callback not handled');
  }
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

  ipcMain.handle('db:getLeagues', () => getLeagues());
  ipcMain.handle('db:insertLeague', (_event, name: string) => insertLeague(name));
  ipcMain.handle('db:getSnapshots', (_event, leagueId: number) => getSnapshots(leagueId));
  ipcMain.handle('db:getSnapshotsWithItemCounts', (_event, leagueId: number) => getSnapshotsWithItemCounts(leagueId));
  ipcMain.handle('db:getSnapshotDetail', (_event, id: number) => getSnapshotDetail(id));
  ipcMain.handle('db:insertSnapshot', (_event, leagueId: number, rawJson: string) => insertSnapshot(leagueId, rawJson));
  ipcMain.handle('db:getStashItems', (_event, snapshotId: number) => getStashItems(snapshotId));
  ipcMain.handle('db:getSnapshotItemCount', (_event, snapshotId: number) => getSnapshotItemCount(snapshotId));
  ipcMain.handle('db:insertStashItem', (_event, data: NewStashItem) => insertStashItem(data));
  ipcMain.handle('db:insertStashItemsBatch', (_event, items: NewStashItem[]) => insertStashItemsBatch(items));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', async (_event, argv) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
  try {
    await tryHandleOAuthCallback(extractDeepLink(argv));
  } catch (error) {
    console.error('[main] Failed to handle OAuth callback from second-instance', error);
    mainWindow?.webContents.send('poe:oauth-callback-error', error instanceof Error ? error.message : String(error));
  }
});

app.on('open-url', async (event, url) => {
  event.preventDefault();
  try {
    await tryHandleOAuthCallback(url);
  } catch (error) {
    console.error('[main] Failed to handle OAuth callback from open-url', error);
    mainWindow?.webContents.send('poe:oauth-callback-error', error instanceof Error ? error.message : String(error));
  }
});

app.whenReady().then(async () => {
  createTables();
  registerCustomProtocolHandler();
  registerIpcHandlers();
  registerPoeIpcHandlers();
  createWindow();

  await tryHandleOAuthCallback(extractDeepLink(process.argv));

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
