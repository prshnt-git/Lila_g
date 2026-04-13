function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-[#111B27] p-4 border border-cyan-500/5">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">
        {label}
      </div>
      <div className="text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

export default function MetricsRow() {
  return (
    <section className="grid grid-cols-4 gap-4 p-4">
      <MetricCard label="Players" value="--" />
      <MetricCard label="Duration" value="--" />
      <MetricCard label="Events" value="--" />
      <MetricCard label="Engagement" value="--" />
    </section>
  );
}