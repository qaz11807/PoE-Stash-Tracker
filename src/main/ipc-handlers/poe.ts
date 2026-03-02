import { ipcMain } from 'electron';
import { PoeApiClient } from '../poe-api';

const poeClient = new PoeApiClient();
const LEAGUE_ID_PATTERN = /^[A-Za-z0-9 _-]{1,64}$/;
const STASH_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function assertValidLeagueId(value: string): void {
  if (!LEAGUE_ID_PATTERN.test(value)) {
    throw new Error('Invalid leagueId format');
  }
}

function assertValidStashId(value: string): void {
  if (!STASH_ID_PATTERN.test(value)) {
    throw new Error('Invalid stashId format');
  }
}

function toIpcError(err: unknown): { ok: false; error: string } {
  return { ok: false, error: err instanceof Error ? err.message : String(err) };
}

export function registerPoeIpcHandlers(): void {
  ipcMain.handle('poe:authenticate', async () => {
    try {
      return { ok: true, data: await poeClient.authenticate() };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle('poe:getLeagues', async () => {
    try {
      return { ok: true, data: await poeClient.getLeagues() };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle('poe:getStashTabs', async (_event, leagueId: string) => {
    try {
      assertValidLeagueId(leagueId);
      return { ok: true, data: await poeClient.getStashTabs(leagueId) };
    } catch (err) {
      return toIpcError(err);
    }
  });

  ipcMain.handle('poe:fetchStash', async (_event, leagueId: string, stashId: string) => {
    try {
      assertValidLeagueId(leagueId);
      assertValidStashId(stashId);
      return { ok: true, data: await poeClient.getStashTabContent(leagueId, stashId) };
    } catch (err) {
      return toIpcError(err);
    }
  });
}

export async function handlePoeOAuthCallback(url: string): Promise<boolean> {
  return poeClient.handleOAuthCallback(url);
}
