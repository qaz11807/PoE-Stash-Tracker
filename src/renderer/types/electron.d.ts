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
  stash_tab_id: string | null;
  tab_name: string | null;
  tab_type: string | null;
  created_at: string;
};

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

declare global {
  interface Window {
    electronAPI: {
      getAppVersion: () => Promise<string>;
      openExternalLink: (url: string) => Promise<void>;
      db: {
        getLeagues: () => Promise<League[]>;
        insertLeague: (name: string) => Promise<number>;
        getSnapshots: (leagueId: number) => Promise<Snapshot[]>;
        getSnapshotsWithItemCounts: (leagueId: number) => Promise<Array<Snapshot & { itemCount: number }>>;
        insertSnapshot: (leagueId: number, rawJson: string) => Promise<number>;
        getStashItems: (snapshotId: number) => Promise<StashItem[]>;
        getSnapshotItemCount: (snapshotId: number) => Promise<number>;
        insertStashItem: (data: NewStashItem) => Promise<number>;
        insertStashItemsBatch: (items: NewStashItem[]) => Promise<void>;
      };
    };
  }
}
