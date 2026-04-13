export default function RightPanel() {
  return (
    <aside className="w-80 border-l border-cyan-500/10 bg-[#0A111A] p-4 overflow-y-auto">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-cyan-400 mb-2">
          Insights
        </div>
        <h2 className="text-xl font-semibold">Match Intelligence</h2>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl bg-[#111B27] p-4">
          <div className="text-sm text-slate-400 mb-1">Top Activity Zone</div>
          <div className="text-base font-medium">Available after data wiring</div>
        </div>

        <div className="rounded-xl bg-[#111B27] p-4">
          <div className="text-sm text-slate-400 mb-1">Combat Hotspot</div>
          <div className="text-base font-medium">Available after data wiring</div>
        </div>

        <div className="rounded-xl bg-[#111B27] p-4">
          <div className="text-sm text-slate-400 mb-1">Human vs Bot Split</div>
          <div className="text-base font-medium">Available after data wiring</div>
        </div>
      </div>
    </aside>
  );
}