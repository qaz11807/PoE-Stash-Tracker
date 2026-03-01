import { FormEvent, useState } from 'react';
import { useTrackerStore } from '../store';

export default function Settings() {
  const league = useTrackerStore((state) => state.league);
  const stashPath = useTrackerStore((state) => state.stashPath);
  const setLeague = useTrackerStore((state) => state.setLeague);
  const setStashPath = useTrackerStore((state) => state.setStashPath);

  const [leagueInput, setLeagueInput] = useState(league);
  const [pathInput, setPathInput] = useState(stashPath);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLeague(leagueInput.trim());
    setStashPath(pathInput.trim());
  };

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">Settings</h2>
      <form onSubmit={onSubmit} className="max-w-xl space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">League</span>
          <input
            value={leagueInput}
            onChange={(e) => setLeagueInput(e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-amber-500 focus:ring"
            placeholder="e.g. Settlers"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">Stash DB Path</span>
          <input
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-amber-500 focus:ring"
            placeholder="/path/to/stash.sqlite"
          />
        </label>

        <button type="submit" className="rounded bg-amber-500 px-4 py-2 font-medium text-slate-900 hover:bg-amber-400">
          Save
        </button>
      </form>
    </section>
  );
}
