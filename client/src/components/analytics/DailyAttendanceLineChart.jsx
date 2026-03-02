import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartCard from "./ChartCard";

const formatDayLabel = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export default function DailyAttendanceLineChart({ data = [] }) {
  return (
    <ChartCard
      title="Attendance Trend (Last 7 Days)"
      subtitle="Daily present attendance rate (%)."
    >
      {data.length === 0 ? (
        <p className="text-sm text-slate-500">No daily analytics available yet.</p>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="day"
                tickFormatter={formatDayLabel}
                tick={{ fill: "#334155", fontSize: 12 }}
              />
              <YAxis domain={[0, 100]} tick={{ fill: "#334155", fontSize: 12 }} />
              <Tooltip
                labelFormatter={formatDayLabel}
                formatter={(value) => [`${value}%`, "Attendance Rate"]}
                contentStyle={{ borderRadius: 8, borderColor: "#cbd5e1" }}
              />
              <Line
                type="monotone"
                dataKey="attendanceRate"
                stroke="#0f766e"
                strokeWidth={3}
                dot={{ r: 4, fill: "#0f766e" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
