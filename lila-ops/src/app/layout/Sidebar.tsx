export default function Sidebar() {
  return (
    <aside className="w-72 border-r border-cyan-500/10 bg-[#0A111A] p-4 overflow-y-auto">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-cyan-400 mb-2">
          Controls
        </div>
        <h2 className="text-xl font-semibold">Filters</h2>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl bg-[#111B27] p-4">
          <label className="block text-sm text-slate-300 mb-2">Map</label>
          <select className="w-full rounded-lg bg-[#0B1420] border border-slate-700 px-3 py-2 text-sm">
            <option>AmbroseValley</option>
            <option>GrandRift</option>
            <option>Lockdown</option>
          </select>
        </div>

        <div className="rounded-xl bg-[#111B27] p-4">
          <label className="block text-sm text-slate-300 mb-2">Date</label>
          <select className="w-full rounded-lg bg-[#0B1420] border border-slate-700 px-3 py-2 text-sm">
            <option>2026-02-10</option>
          </select>
        </div>

        <div className="rounded-xl bg-[#111B27] p-4">
          <label className="block text-sm text-slate-300 mb-2">Match</label>
          <select className="w-full rounded-lg bg-[#0B1420] border border-slate-700 px-3 py-2 text-sm">
            <option>Loading later</option>
          </select>
        </div>

        <div className="rounded-xl bg-[#111B27] p-4">
          <label className="block text-sm text-slate-300 mb-2">Quality</label>
          <select className="w-full rounded-lg bg-[#0B1420] border border-slate-700 px-3 py-2 text-sm">
            <option>recommended</option>
            <option>playable</option>
            <option>debug_only</option>
          </select>
        </div>
      </div>
    </aside>
  );
}