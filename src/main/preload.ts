import { contextBridge, ipcRenderer } from 'electron';

type NewStashItem = {
  itemId: string;
  leagueId: number | null;
  snapshotId: number | null;
  name?: string | null;
  typeLine?: string | null;
  stackSize?: number | null;
  note?: string | null;
};

const electronAPI = {
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version'),
  openExternalLink: (url: string): Promise<void> => ipcRenderer.invoke('app:open-external-link', url),
  db: {
    getLeagues: (): Promise<unknown[]> => ipcRenderer.invoke('db:getLeagues'),
    insertLeague: (name: string): Promise<number> => ipcRenderer.invoke('db:insertLeague', name),
    getSnapshots: (leagueId: number): Promise<unknown[]> => ipcRenderer.invoke('db:getSnapshots', leagueId),
    insertSnapshot: (leagueId: number, rawJson: string): Promise<number> =>
      ipcRenderer.invoke('db:insertSnapshot', leagueId, rawJson),
    getStashItems: (snapshotId: number): Promise<unknown[]> => ipcRenderer.invoke('db:getStashItems', snapshotId),
    insertStashItem: (data: NewStashItem): Promise<number> => ipcRenderer.invoke('db:insertStashItem', data)
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
