import { useEffect, useMemo, useState } from "react";
import apiClient from "../api/client";
import AttendancePieChart from "../components/charts/AttendancePieChart";
import StatusBadge from "../components/StatusBadge";

const DEFAULT_MINIMUM_REQUIRED = 75;

const aggregateStatusCounts = (subjects) =>
  subjects.reduce(
    (acc, subject) => {
      acc.present += subject.present || 0;
      acc.absent += subject.absent || 0;
      acc.flagged += subject.flagged || 0;
      return acc;
    },
    { present: 0, absent: 0, flagged: 0 }
  );

export default function StudentAttendanceAnalytics() {
  const [subjects, setSubjects] = useState([]);
  const [overallPercentage, setOverallPercentage] = useState(0);
  const [minimumRequired, setMinimumRequired] = useState(DEFAULT_MINIMUM_REQUIRED);
  const [classesNeeded, setClassesNeeded] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Loading attendance analytics...");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        setIsLoading(true);
        const response = await apiClient.get("/api/student/attendance-summary");
        const data = response.data || {};
        setSubjects(data.subjects || []);
        setOverallPercentage(Number(data.overallPercentage || 0));
        setMinimumRequired(Number(data.minimumRequired || DEFAULT_MINIMUM_REQUIRED));
        setClassesNeeded(Number(data.classesNeededToReachMinimum || 0));
        setStatusMessage("Attendance analytics updated.");
      } catch (error) {
        setStatusMessage(
          error.response?.data?.message || "Failed to load attendance analytics."
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadSummary();
  }, []);

  const statusCounts = useMemo(() => aggregateStatusCounts(subjects), [subjects]);
  const pieChartData = useMemo(
    () => [
      { name: "Present", value: statusCounts.present },
      { name: "Absent", value: statusCounts.absent },
      { name: "Flagged", value: statusCounts.flagged },
    ],
    [statusCounts]
  );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <section className="mx-auto w-full max-w-7xl space-y-6">
        <article className="rounded-xl bg-white p-6 shadow">
          <h1 className="text-2xl font-semibold text-slate-900">Student Attendance Analytics</h1>
          <p className="mt-1 text-sm text-slate-600">
            Subject-level breakdown and shortage tracking.
          </p>
          <p className="mt-3 text-sm text-slate-700">{statusMessage}</p>
        </article>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <article className="rounded-xl bg-white p-5 shadow">
            <p className="text-xs uppercase tracking-wide text-slate-500">Overall Attendance</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {isLoading ? "-" : `${overallPercentage}%`}
            </p>
          </article>

          <article className="rounded-xl bg-white p-5 shadow">
            <p className="text-xs uppercase tracking-wide text-slate-500">Minimum Required</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {isLoading ? "-" : `${minimumRequired}%`}
            </p>
          </article>

          <article className="rounded-xl bg-white p-5 shadow">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Classes Needed To Reach {minimumRequired}%
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {isLoading ? "-" : classesNeeded}
            </p>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <article className="rounded-xl bg-white p-5 shadow">
            <h2 className="text-lg font-semibold text-slate-900">Subject Summary</h2>
            <p className="mt-1 text-sm text-slate-600">
              Total classes, status breakdown, and shortage by subject.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {subjects.map((item) => (
                <div key={item.subject} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-slate-900">{item.subject}</h3>
                    <StatusBadge
                      label={`${item.percentage}%`}
                      variant={item.percentage >= item.minimumRequired ? "present" : "absent"}
                    />
                  </div>

                  <div className="mt-3 space-y-1 text-sm text-slate-700">
                    <p>Total Classes: {item.totalClasses}</p>
                    <p>Present: {item.present}</p>
                    <p>Absent: {item.absent}</p>
                    <p>Flagged: {item.flagged}</p>
                    <p>Minimum Required: {item.minimumRequired}%</p>
                    <p>Classes Needed: {item.shortage}</p>
                  </div>
                </div>
              ))}

              {!isLoading && subjects.length === 0 && (
                <p className="text-sm text-slate-500">No subject records found.</p>
              )}
            </div>
          </article>

          <AttendancePieChart data={pieChartData} title="Attendance Distribution" />
        </section>
      </section>
    </main>
  );
}
