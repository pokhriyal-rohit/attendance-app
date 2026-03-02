import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import ChartCard from "./ChartCard";

const STATUS_COLORS = {
  Present: "#16a34a",
  Absent: "#dc2626",
  Flagged: "#f97316",
};

export default function StatusBreakdownPieChart({ data = [] }) {
  return (
    <ChartCard
      title="Status Breakdown"
      subtitle="Present vs Absent vs Flagged distribution."
    >
      {data.length === 0 ? (
        <p className="text-sm text-slate-500">No status breakdown available yet.</p>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={95}
                label
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={STATUS_COLORS[entry.status] || "#64748b"}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [value, name]}
                contentStyle={{ borderRadius: 8, borderColor: "#cbd5e1" }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
