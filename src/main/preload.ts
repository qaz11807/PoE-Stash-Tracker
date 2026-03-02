import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version'),
  openExternalLink: (url: string): Promise<void> => ipcRenderer.invoke('app:open-external-link', url),
  db: {
    query: (sql: string, params: unknown[] = []): Promise<unknown[]> => ipcRenderer.invoke('db:query', sql, params),
    run: (sql: string, params: unknown[] = []): Promise<unknown> => ipcRenderer.invoke('db:run', sql, params)
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
