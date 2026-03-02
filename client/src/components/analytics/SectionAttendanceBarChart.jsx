import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartCard from "./ChartCard";

export default function SectionAttendanceBarChart({ data = [] }) {
  return (
    <ChartCard
      title="Attendance Per Section"
      subtitle="Present attendance rate (%) across all finalized records."
    >
      {data.length === 0 ? (
        <p className="text-sm text-slate-500">No section analytics available yet.</p>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="section" tick={{ fill: "#334155", fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "#334155", fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [`${value}%`, "Attendance Rate"]}
                contentStyle={{ borderRadius: 8, borderColor: "#cbd5e1" }}
              />
              <Bar dataKey="attendanceRate" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
