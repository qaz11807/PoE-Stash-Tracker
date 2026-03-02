import { ipcMain } from 'electron';
import { PoeApiClient } from '../poe-api';

const poeClient = new PoeApiClient();

export function registerPoeIpcHandlers(): void {
  ipcMain.handle('poe:authenticate', async () => poeClient.authenticate());
  ipcMain.handle('poe:getLeagues', async () => poeClient.getLeagues());
  ipcMain.handle('poe:getStashTabs', async (_event, leagueId: string) => poeClient.getStashTabs(leagueId));
  ipcMain.handle('poe:fetchStash', async (_event, leagueId: string, stashId: string) => {
    return poeClient.getStashTabContent(leagueId, stashId);
  });
}

export async function handlePoeOAuthCallback(url: string): Promise<boolean> {
  return poeClient.handleOAuthCallback(url);
}
