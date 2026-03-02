import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDashboardData } from '../hooks/useDashboardData';

export default function Dashboard() {
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<'name' | 'stack_size'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { leagues, snapshots, latestSnapshot, items, isLoading, error } = useDashboardData(selectedLeagueId);

  const itemsPerPage = 20;

  // Auto-select first league if none selected
  if (leagues.length > 0 && selectedLeagueId === null) {
    setSelectedLeagueId(leagues[0].id);
  }

  // Calculate summary statistics
  const totalItems = items.length;
  const totalStashTabs = new Set(items.map((item) => item.stash_tab_id).filter(Boolean)).size;
  const snapshotsCount = snapshots.length;
  const lastSnapshotTime = latestSnapshot
    ? new Date(latestSnapshot.captured_at).toLocaleString('zh-TW')
    : '尚無快照';

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let result = items.filter((item) => {
      const name = item.name || item.type_line || '';
      return name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    result.sort((a, b) => {
      if (sortField === 'name') {
        const aName = a.name || a.type_line || '';
        const bName = b.name || b.type_line || '';
        return sortOrder === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName);
      } else {
        const aSize = a.stack_size || 0;
        const bSize = b.stack_size || 0;
        return sortOrder === 'asc' ? aSize - bSize : bSize - aSize;
      }
    });

    return result;
  }, [items, searchTerm, sortField, sortOrder]);

  // Paginate items
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Prepare chart data
  const chartData = useMemo(() => {
    return snapshots.map((snapshot) => ({
      date: new Date(snapshot.captured_at).toLocaleDateString('zh-TW', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
      }),
      count: 0, // We'll need to query item counts per snapshot in a real implementation
    }));
  }, [snapshots]);

  const handleSort = (field: 'name' | 'stack_size') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  if (isLoading) {
    return (
      <section className="flex h-full items-center justify-center">
        <div className="text-slate-400">載入中...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex h-full items-center justify-center">
        <div className="text-red-400">錯誤: {error}</div>
      </section>
    );
  }

  if (leagues.length === 0) {
    return (
      <section className="flex h-full items-center justify-center">
        <div className="text-slate-400">尚未設定任何聯盟</div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/* Header with League Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">資產總覽</h2>
        <select
          value={selectedLeagueId || ''}
          onChange={(e) => {
            setSelectedLeagueId(Number(e.target.value));
            setCurrentPage(1);
          }}
          className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-200 focus:border-amber-500 focus:outline-none"
        >
          {leagues.map((league) => (
            <option key={league.id} value={league.id}>
              {league.name}
            </option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-sm uppercase tracking-wide text-slate-400">總物品數</h3>
          <p className="mt-2 text-3xl font-bold text-amber-500">{totalItems}</p>
        </article>
        <article className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-sm uppercase tracking-wide text-slate-400">倉庫分頁數</h3>
          <p className="mt-2 text-3xl font-bold text-amber-500">{totalStashTabs}</p>
        </article>
        <article className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-sm uppercase tracking-wide text-slate-400">快照數量</h3>
          <p className="mt-2 text-3xl font-bold text-amber-500">{snapshotsCount}</p>
        </article>
        <article className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-sm uppercase tracking-wide text-slate-400">最後快照時間</h3>
          <p className="mt-2 text-sm font-medium text-slate-200">{lastSnapshotTime}</p>
        </article>
      </div>

      {/* Snapshot History Chart */}
      {chartData.length > 0 && (
        <article className="rounded-lg border border-slate-800 bg-slate-900 p-6">
          <h3 className="mb-4 text-lg font-semibold text-slate-200">快照歷史趨勢</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#94a3b8' }} />
              <YAxis stroke="#64748b" tick={{ fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.5rem',
                  color: '#e2e8f0',
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#F59E0B"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCount)"
              />
            </AreaChart>
          </ResponsiveContainer>
          <p className="mt-2 text-sm text-slate-400">
            註: 目前顯示快照時間軸，物品數量統計功能待實作
          </p>
        </article>
      )}

      {/* Stash Items Table */}
      <article className="rounded-lg border border-slate-800 bg-slate-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-200">倉庫物品列表</h3>
          <input
            type="text"
            placeholder="搜尋物品名稱..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
        </div>

        {filteredItems.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            {searchTerm ? '找不到符合的物品' : '目前沒有物品資料'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-sm uppercase tracking-wide text-slate-400">
                    <th
                      className="cursor-pointer px-4 py-3 hover:text-amber-500"
                      onClick={() => handleSort('name')}
                    >
                      物品名稱{' '}
                      {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3">類型</th>
                    <th
                      className="cursor-pointer px-4 py-3 text-right hover:text-amber-500"
                      onClick={() => handleSort('stack_size')}
                    >
                      數量{' '}
                      {sortField === 'stack_size' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3">分頁名稱</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-slate-800 transition-colors hover:bg-slate-800/50"
                    >
                      <td className="px-4 py-3 font-medium text-slate-200">
                        {item.name || '未命名'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {item.type_line || '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-amber-500">
                        {item.stack_size || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {item.tab_name || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-slate-400">
                  顯示 {(currentPage - 1) * itemsPerPage + 1} 至{' '}
                  {Math.min(currentPage * itemsPerPage, filteredItems.length)} 項，共{' '}
                  {filteredItems.length} 項
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-200 transition-colors hover:border-amber-500 disabled:opacity-50 disabled:hover:border-slate-700"
                  >
                    上一頁
                  </button>
                  <div className="flex items-center px-4 text-slate-400">
                    第 {currentPage} / {totalPages} 頁
                  </div>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-200 transition-colors hover:border-amber-500 disabled:opacity-50 disabled:hover:border-slate-700"
                  >
                    下一頁
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </article>
    </section>
  );
}
