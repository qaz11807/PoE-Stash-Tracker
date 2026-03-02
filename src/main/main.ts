import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { handlePoeOAuthCallback, registerPoeIpcHandlers } from './ipc-handlers/poe';

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

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

function registerCustomProtocolHandler(): void {
  if (process.defaultApp) {
    app.setAsDefaultProtocolClient(CUSTOM_PROTOCOL, process.execPath, [path.resolve(process.argv[1] ?? '')]);
    return;
  }

  app.setAsDefaultProtocolClient(CUSTOM_PROTOCOL);
}

function extractDeepLink(argv: string[]): string | null {
  return argv.find((arg) => arg.startsWith(`${CUSTOM_PROTOCOL}://`)) ?? null;
}

async function tryHandleOAuthCallback(url: string | null): Promise<void> {
  if (!url) {
    return;
  }

  await handlePoeOAuthCallback(url);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on('second-instance', async (_event, argv) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }

  await tryHandleOAuthCallback(extractDeepLink(argv));
});

app.on('open-url', async (event, url) => {
  event.preventDefault();
  await tryHandleOAuthCallback(url);
});

app.whenReady().then(async () => {
  registerCustomProtocolHandler();
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
