import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { useAuthStore } from './store/authStore';

type Tab = 'dashboard' | 'settings';

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const username = useAuthStore((state) => state.username);
  const reset = useAuthStore((state) => state.reset);

  if (!isAuthenticated) {
    return <Login />;
  }

  const handleDisconnect = () => {
    reset();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold">PoE Stash Tracker</h1>
            {username && <p className="text-xs text-slate-400">{username}</p>}
          </div>
          <nav className="flex items-center gap-2">
            <button
              className={`rounded px-3 py-1.5 text-sm ${
                tab === 'dashboard' ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 hover:bg-slate-700'
              }`}
              onClick={() => setTab('dashboard')}
            >
              總覽
            </button>
            <button
              className={`rounded px-3 py-1.5 text-sm ${
                tab === 'settings' ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 hover:bg-slate-700'
              }`}
              onClick={() => setTab('settings')}
            >
              設定
            </button>
            <button
              onClick={handleDisconnect}
              className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              登出
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">{tab === 'dashboard' ? <Dashboard /> : <Settings />}</main>
    </div>
  );
}
