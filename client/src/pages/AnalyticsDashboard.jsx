import { useEffect, useMemo, useState } from "react";
import apiClient from "../api/client";
import DailyAttendanceLineChart from "../components/analytics/DailyAttendanceLineChart";
import SectionAttendanceBarChart from "../components/analytics/SectionAttendanceBarChart";
import StatusBreakdownPieChart from "../components/analytics/StatusBreakdownPieChart";

const DEFAULT_ANALYTICS = {
  totalStudents: 0,
  totalTeachers: 0,
  totalRooms: 0,
  flaggedStudentCount: 0,
  attendanceRatePerSection: [],
  attendanceRatePerDay: [],
  statusBreakdown: [],
};

export default function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState(DEFAULT_ANALYTICS);
  const [statusMessage, setStatusMessage] = useState("Loading analytics...");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setIsLoading(true);
        const response = await apiClient.get("/api/analytics/overview");
        setAnalytics({
          ...DEFAULT_ANALYTICS,
          ...response.data,
        });
        setStatusMessage("Analytics updated.");
      } catch (error) {
        setStatusMessage(error.response?.data?.message || "Failed to load analytics.");
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, []);

  const summaryCards = useMemo(
    () => [
      { label: "Total Students", value: analytics.totalStudents },
      { label: "Total Teachers", value: analytics.totalTeachers },
      { label: "Total Rooms", value: analytics.totalRooms },
      { label: "Flagged Students", value: analytics.flaggedStudentCount },
    ],
    [
      analytics.flaggedStudentCount,
      analytics.totalRooms,
      analytics.totalStudents,
      analytics.totalTeachers,
    ]
  );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <section className="mx-auto w-full max-w-7xl space-y-6">
        <article className="rounded-xl bg-white p-6 shadow">
          <h1 className="text-2xl font-semibold text-slate-900">Analytics Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Section-level and daily attendance intelligence for teachers and admins.
          </p>
          <p className="mt-3 text-sm text-slate-700">{statusMessage}</p>
        </article>

        <article className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-xl bg-white p-5 shadow">
              <p className="text-xs uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {isLoading ? "-" : card.value}
              </p>
            </div>
          ))}
        </article>

        <section className="grid gap-6 lg:grid-cols-2">
          <SectionAttendanceBarChart data={analytics.attendanceRatePerSection} />
          <DailyAttendanceLineChart data={analytics.attendanceRatePerDay} />
        </section>

        <section className="grid gap-6">
          <StatusBreakdownPieChart data={analytics.statusBreakdown} />
        </section>
      </section>
    </main>
  );
}
