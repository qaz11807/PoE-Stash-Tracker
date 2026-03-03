import { useState, useEffect } from 'react';

type League = {
  id: number;
  name: string;
  created_at: string;
};

type Snapshot = {
  id: number;
  league_id: number | null;
  captured_at: string;
  itemCount?: number;
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

export function useDashboardData(leagueId: number | null) {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [latestSnapshot, setLatestSnapshot] = useState<Snapshot | null>(null);
  const [items, setItems] = useState<StashItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load leagues on mount
  useEffect(() => {
    async function loadLeagues() {
      try {
        const result = await window.electronAPI.db.getLeagues();
        setLeagues(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : '載入聯盟資料失敗');
      }
    }
    loadLeagues();
  }, []);

  // Load snapshots and items when league changes
  useEffect(() => {
    async function loadData() {
      if (!leagueId) {
        setSnapshots([]);
        setLatestSnapshot(null);
        setItems([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Load snapshots with item counts in a single JOIN query (no N+1)
        const snapshotsWithCounts = await window.electronAPI.db.getSnapshotsWithItemCounts(leagueId);
        setSnapshots(snapshotsWithCounts);

        // Get the latest snapshot
        const latest = snapshotsWithCounts.length > 0 ? snapshotsWithCounts[0] : null;
        setLatestSnapshot(latest);

        // Load items from the latest snapshot
        if (latest) {
          const itemList = await window.electronAPI.db.getStashItems(latest.id);
          setItems(itemList);
        } else {
          setItems([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '載入資料失敗');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [leagueId]);

  return {
    leagues,
    snapshots,
    latestSnapshot,
    items,
    isLoading,
    error,
  };
}
