import { useTrackerStore } from '../store';

export default function Dashboard() {
  const league = useTrackerStore((state) => state.league);
  const stashPath = useTrackerStore((state) => state.stashPath);

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Dashboard</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-sm uppercase tracking-wide text-slate-400">Current League</h3>
          <p className="mt-2 text-xl font-medium">{league || 'Not set'}</p>
        </article>
        <article className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-sm uppercase tracking-wide text-slate-400">Stash DB Path</h3>
          <p className="mt-2 break-all text-sm text-slate-200">{stashPath || 'Not configured'}</p>
        </article>
      </div>
    </section>
  );
}
