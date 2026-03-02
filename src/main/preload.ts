import { contextBridge, ipcRenderer } from 'electron';

const poeApi = {
  authenticate: () => ipcRenderer.invoke('poe:authenticate'),
  getLeagues: () => ipcRenderer.invoke('poe:getLeagues'),
  getStashTabs: (leagueId: string) => ipcRenderer.invoke('poe:getStashTabs', leagueId),
  fetchStash: (leagueId: string, stashId: string) => ipcRenderer.invoke('poe:fetchStash', leagueId, stashId),
  onOAuthError: (callback: (message: string) => void) => {
    ipcRenderer.on('poe:oauth-callback-error', (_event, msg: string) => callback(msg));
  },
  onOAuthSuccess: (callback: () => void) => {
    ipcRenderer.on('poe:oauth-success', () => callback());
  }
};

contextBridge.exposeInMainWorld('poe', poeApi);
