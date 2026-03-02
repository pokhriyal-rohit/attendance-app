export default function ChartCard({ title, subtitle, children }) {
  return (
    <article className="rounded-xl bg-white p-5 shadow">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
      </div>
      {children}
    </article>
  );
}
