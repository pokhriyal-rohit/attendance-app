import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const DEFAULT_COLORS = {
  Present: "#16a34a",
  Absent: "#dc2626",
  Flagged: "#f97316",
};

export default function AttendancePieChart({ data = [], title }) {
  return (
    <article className="rounded-xl bg-white p-5 shadow">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">Present vs Absent vs Flagged</p>

      {data.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No attendance records available.</p>
      ) : (
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={95}
                label
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={DEFAULT_COLORS[entry.name] || "#64748b"}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [value, name]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}
