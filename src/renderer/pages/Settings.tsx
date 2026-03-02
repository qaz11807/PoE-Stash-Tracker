import { FormEvent, useState } from 'react';
import { useTrackerStore } from '../store';
import { useAuthStore } from '../store/authStore';
import type { StashTab } from '../types/poe';

export default function Settings() {
  const league = useTrackerStore((state) => state.league);
  const stashPath = useTrackerStore((state) => state.stashPath);
  const setLeague = useTrackerStore((state) => state.setLeague);
  const setStashPath = useTrackerStore((state) => state.setStashPath);

  const [leagueInput, setLeagueInput] = useState(league);
  const [pathInput, setPathInput] = useState(stashPath);

  // Stash tabs state
  const leagues = useAuthStore((state) => state.leagues);
  const selectedLeague = useAuthStore((state) => state.selectedLeague);
  const setSelectedLeague = useAuthStore((state) => state.setSelectedLeague);
  const [stashTabs, setStashTabs] = useState<StashTab[]>([]);
  const [loadingTabs, setLoadingTabs] = useState(false);
  const [tabsError, setTabsError] = useState<string | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState<string | null>(null);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLeague(leagueInput.trim());
    setStashPath(pathInput.trim());
  };

  const handleFetchStashTabs = async () => {
    if (!selectedLeague) {
      setTabsError('請選擇一個賽季');
      return;
    }

    setLoadingTabs(true);
    setTabsError(null);

    try {
      const tabs = await window.poe.getStashTabs(selectedLeague);
      setStashTabs(tabs);
    } catch (error) {
      setTabsError(error instanceof Error ? error.message : '獲取倉庫分頁失敗');
    } finally {
      setLoadingTabs(false);
    }
  };

  const handleTakeSnapshot = async (tab: StashTab) => {
    if (!selectedLeague) {
      return;
    }

    setSnapshotLoading(tab.id);

    try {
      // Fetch stash items
      const items = await window.poe.fetchStash(selectedLeague, tab.id);

      // Get or create league in database
      const leagueDbId = await window.electronAPI.db.insertLeague(selectedLeague);

      // Create snapshot
      const snapshotId = await window.electronAPI.db.insertSnapshot(
        leagueDbId,
        JSON.stringify({ tabId: tab.id, tabName: tab.name, items })
      );

      // Save items to database
      const dbItems = items.map((item) => ({
        item_id: item.id,
        league_id: leagueDbId,
        snapshot_id: snapshotId,
        name: item.name || null,
        type_line: item.typeLine || null,
        stack_size: item.stackSize || null,
        note: item.note || null,
        stash_tab_id: tab.id,
        tab_name: tab.name,
        tab_type: tab.type || null
      }));

      await window.electronAPI.db.insertStashItemsBatch(dbItems);

      alert(`成功擷取 ${tab.name} 的快照！共 ${items.length} 個物品`);
    } catch (error) {
      alert(`擷取快照失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
    } finally {
      setSnapshotLoading(null);
    }
  };

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">設定</h2>
        <form onSubmit={onSubmit} className="mt-4 max-w-xl space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">賽季</span>
            <input
              value={leagueInput}
              onChange={(e) => setLeagueInput(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-amber-500 focus:ring"
              placeholder="例如: Settlers"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">倉庫資料庫路徑</span>
            <input
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-amber-500 focus:ring"
              placeholder="/path/to/stash.sqlite"
            />
          </label>

          <button type="submit" className="rounded bg-amber-500 px-4 py-2 font-medium text-slate-900 hover:bg-amber-400">
            儲存
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-2xl font-semibold">倉庫分頁</h2>
        <div className="mt-4 max-w-xl space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">選擇賽季</span>
            <select
              value={selectedLeague || ''}
              onChange={(e) => setSelectedLeague(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-amber-500 focus:ring"
            >
              <option value="">-- 選擇賽季 --</option>
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.id}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={handleFetchStashTabs}
            disabled={!selectedLeague || loadingTabs}
            className="w-full rounded bg-amber-500 px-4 py-2 font-medium text-slate-900 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingTabs ? '載入中...' : '獲取倉庫分頁'}
          </button>

          {tabsError && (
            <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
              {tabsError}
            </div>
          )}

          {stashTabs.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-slate-400">共 {stashTabs.length} 個分頁</p>
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {stashTabs.map((tab) => (
                  <div
                    key={tab.id}
                    className="flex items-center justify-between rounded border border-slate-700 bg-slate-950 p-3"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{tab.name}</p>
                      <p className="text-xs text-slate-400">
                        {tab.type} - 索引 {tab.index}
                      </p>
                    </div>
                    <button
                      onClick={() => handleTakeSnapshot(tab)}
                      disabled={snapshotLoading === tab.id}
                      className="rounded bg-amber-500 px-3 py-1 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {snapshotLoading === tab.id ? '擷取中...' : '擷取快照'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
