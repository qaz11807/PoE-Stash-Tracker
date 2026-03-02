import type { League, StashItem, StashTab } from './poe';

declare global {
  interface Window {
    poe: {
      authenticate: () => Promise<{ authenticated: boolean; expiresAt: number }>;
      getLeagues: () => Promise<League[]>;
      getStashTabs: (leagueId: string) => Promise<StashTab[]>;
      fetchStash: (leagueId: string, stashId: string) => Promise<StashItem[]>;
    };
  }
}

export {};
