export default function PlaybackControls() {
  return (
    <section className="h-20 border-t border-cyan-500/10 bg-[#050B14] px-4 flex items-center gap-4">
      <button className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-4 py-2 text-cyan-300">
        Play
      </button>

      <button className="rounded-lg bg-slate-800 px-4 py-2 text-slate-300">
        Pause
      </button>

      <div className="flex-1">
        <input type="range" min="0" max="100" className="w-full" />
      </div>

      <select className="rounded-lg bg-[#111B27] border border-slate-700 px-3 py-2 text-sm">
        <option>1x</option>
        <option>2x</option>
        <option>4x</option>
      </select>
    </section>
  );
}