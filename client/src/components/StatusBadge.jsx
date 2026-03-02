const classByVariant = {
  inside: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  present: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  outside: "bg-red-100 text-red-700 border border-red-200",
  absent: "bg-red-100 text-red-700 border border-red-200",
  pending: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  flagged: "bg-orange-100 text-orange-700 border border-orange-200",
  neutral: "bg-slate-100 text-slate-700 border border-slate-200",
};

export default function StatusBadge({ label, variant = "neutral" }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classByVariant[variant] || classByVariant.neutral}`}
    >
      {label}
    </span>
  );
}
