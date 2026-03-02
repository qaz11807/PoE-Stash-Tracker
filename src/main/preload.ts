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
    getSnapshotDetail: (id: number): Promise<unknown | null> => ipcRenderer.invoke('db:getSnapshotDetail', id),
    insertSnapshot: (leagueId: number, rawJson: string): Promise<number> =>
      ipcRenderer.invoke('db:insertSnapshot', leagueId, rawJson),
    getStashItems: (snapshotId: number): Promise<unknown[]> => ipcRenderer.invoke('db:getStashItems', snapshotId),
    insertStashItem: (data: NewStashItem): Promise<number> => ipcRenderer.invoke('db:insertStashItem', data),
    insertStashItemsBatch: (items: NewStashItem[]): Promise<void> => ipcRenderer.invoke('db:insertStashItemsBatch', items),
    saveStashSnapshot: (leagueId: number, rawJson: string, items: NewStashItem[]): Promise<{ snapshotId: number; itemCount: number }> =>
      ipcRenderer.invoke('db:saveStashSnapshot', leagueId, rawJson, items)
  }
};

const poeApi = {
  authenticate: () => ipcRenderer.invoke('poe:authenticate'),
  getLeagues: () => ipcRenderer.invoke('poe:getLeagues'),
  getStashTabs: (leagueId: string) => ipcRenderer.invoke('poe:getStashTabs', leagueId),
  fetchStash: (leagueId: string, stashId: string) => ipcRenderer.invoke('poe:fetchStash', leagueId, stashId),
  onOAuthError: (callback: (message: string) => void) => {
    const handler = (_event: unknown, msg: string) => callback(msg);
    ipcRenderer.on('poe:oauth-callback-error', handler);
    return () => ipcRenderer.removeListener('poe:oauth-callback-error', handler);
  },
  onOAuthSuccess: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('poe:oauth-success', handler);
    return () => ipcRenderer.removeListener('poe:oauth-success', handler);
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
contextBridge.exposeInMainWorld('poe', poeApi);
