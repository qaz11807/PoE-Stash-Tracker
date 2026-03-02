export {};

type League = {
  id: number;
  name: string;
  created_at: string;
};

type Snapshot = {
  id: number;
  league_id: number | null;
  captured_at: string;
  raw_json: string | null;
};

type StashItem = {
  id: number;
  item_id: string;
  league_id: number | null;
  snapshot_id: number | null;
  name: string | null;
  type_line: string | null;
  stack_size: number | null;
  note: string | null;
  created_at: string;
};

type NewStashItem = {
  itemId: string;
  leagueId: number | null;
  snapshotId: number | null;
  name?: string | null;
  typeLine?: string | null;
  stackSize?: number | null;
  note?: string | null;
};

declare global {
  interface Window {
    electronAPI: {
      getAppVersion: () => Promise<string>;
      openExternalLink: (url: string) => Promise<void>;
      db: {
        getLeagues: () => Promise<League[]>;
        insertLeague: (name: string) => Promise<number>;
        getSnapshots: (leagueId: number) => Promise<Snapshot[]>;
        insertSnapshot: (leagueId: number, rawJson: string) => Promise<number>;
        getStashItems: (snapshotId: number) => Promise<StashItem[]>;
        insertStashItem: (data: NewStashItem) => Promise<number>;
      };
    };
  }
}
