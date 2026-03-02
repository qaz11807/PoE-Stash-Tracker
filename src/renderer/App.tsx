import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';

type Tab = 'dashboard' | 'settings';

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold">PoE Stash Tracker</h1>
          <nav className="flex gap-2">
            <button
              className={`rounded px-3 py-1.5 text-sm ${
                tab === 'dashboard' ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 hover:bg-slate-700'
              }`}
              onClick={() => setTab('dashboard')}
            >
              Dashboard
            </button>
            <button
              className={`rounded px-3 py-1.5 text-sm ${
                tab === 'settings' ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 hover:bg-slate-700'
              }`}
              onClick={() => setTab('settings')}
            >
              Settings
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">{tab === 'dashboard' ? <Dashboard /> : <Settings />}</main>
    </div>
  );
}
