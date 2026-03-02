import { contextBridge, ipcRenderer } from 'electron';

type NewStashItem = {
  item_id: string;
  league_id: number | null;
  snapshot_id: number | null;
  name?: string | null;
  type_line?: string | null;
  stack_size?: number | null;
  note?: string | null;
  stash_tab_id?: string | null;
  tab_name?: string | null;
  tab_type?: string | null;
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
    insertStashItem: (data: NewStashItem): Promise<number> => ipcRenderer.invoke('db:insertStashItem', data),
    insertStashItemsBatch: (items: NewStashItem[]): Promise<void> => ipcRenderer.invoke('db:insertStashItemsBatch', items)
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
