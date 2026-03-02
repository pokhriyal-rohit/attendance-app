import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import apiClient from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { API_BASE } from "../config/api";
import { getAuthSession } from "../utils/auth";

const getStatusVariant = (status, isSuspicious) => {
  if (isSuspicious || status === "Flagged") return "flagged";
  if (status === "Present") return "present";
  if (status === "Absent") return "absent";
  return "pending";
};

const summarizeRecords = (records, totalStudentsFallback = 0) => {
  const summary = records.reduce(
    (acc, record) => {
      if (record.status === "Present") acc.present += 1;
      if (record.status === "Flagged" || record.isSuspicious) acc.flagged += 1;
      if (record.insideNow) acc.insideNow += 1;
      return acc;
    },
    {
      totalStudents: Math.max(totalStudentsFallback, records.length),
      present: 0,
      absent: Math.max(totalStudentsFallback, records.length),
      flagged: 0,
      insideNow: 0,
    }
  );
  summary.absent = Math.max(0, summary.totalStudents - summary.present - summary.flagged);
  return summary;
};

export default function TeacherDashboard() {
  const session = getAuthSession();
  const token = session?.token || "";

  const [section, setSection] = useState(session?.user?.section || "A1");
  const [dashboard, setDashboard] = useState(null);
  const [statusMessage, setStatusMessage] = useState("Loading dashboard...");
  const [isLoading, setIsLoading] = useState(true);
  const [rooms, setRooms] = useState([]);
  const [currentRoomId, setCurrentRoomId] = useState("");
  const [targetRoomId, setTargetRoomId] = useState("");
  const [shiftMessage, setShiftMessage] = useState("");
  const [isShifting, setIsShifting] = useState(false);
  const [conflictInfo, setConflictInfo] = useState(null);
  const socketRef = useRef(null);

  const applyLiveUpdate = (payload, roomId) => {
    if (!payload) {
      return;
    }

    const payloadRoomId = payload.roomId || payload.room?.id || null;
    if (!payloadRoomId || String(payloadRoomId) !== String(roomId)) {
      return;
    }

    setDashboard((prev) => {
      if (!prev) return prev;

      const nextRecords = [...(prev.attendanceRecords || [])];
      const incomingStudentId = String(payload.student?.id || payload.studentId || "");
      if (!incomingStudentId) {
        return prev;
      }

      const index = nextRecords.findIndex(
        (record) => String(record.studentId) === incomingStudentId
      );

      const attendance = payload.attendance || {};
      const nextRecord = {
        studentId: payload.student?.id || payload.studentId,
        name: payload.student?.name || payload.name || "Unknown",
        section: payload.student?.section || payload.section || "",
        insideNow:
          typeof payload.inside === "boolean"
            ? payload.inside
            : Boolean(attendance.inside),
        insideTime: attendance.insideTime || 0,
        boundaryCrossings: attendance.boundaryCrossings || 0,
        status: attendance.status || "Pending",
        isSuspicious: Boolean(attendance.isSuspicious),
        lastUpdated: attendance.lastUpdated || payload.timestamp || null,
      };

      if (index >= 0) {
        nextRecords[index] = nextRecord;
      } else {
        nextRecords.push(nextRecord);
      }

      const summary = summarizeRecords(nextRecords, prev.summary?.totalStudents || 0);
      return { ...prev, attendanceRecords: nextRecords, summary };
    });
  };

  const loadDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get(
        `/api/teacher/section/${encodeURIComponent(section)}`
      );
      setDashboard(response.data);
      setStatusMessage("Connected. Waiting for real-time updates.");
    } catch (error) {
      setStatusMessage(error.response?.data?.message || "Failed to load teacher dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [section]);

  useEffect(() => {
    const loadRooms = async () => {
      try {
        const response = await apiClient.get("/api/rooms");
        setRooms(Array.isArray(response.data) ? response.data : []);
      } catch (_error) {
        setRooms([]);
      }
    };

    loadRooms();
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (dashboard?.room?.id) {
      setCurrentRoomId(String(dashboard.room.id));
    }
  }, [dashboard?.room?.id]);

  useEffect(() => {
    const roomId = dashboard?.room?.id;
    if (!roomId || !token) {
      return undefined;
    }

    const socket = io(API_BASE, {
      auth: { token },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("joinRoom", roomId);
      setStatusMessage("Live socket connected.");
    });

    socket.on("attendance:update", (payload) => {
      applyLiveUpdate(payload, roomId);
    });

    socket.on("attendanceUpdate", (payload) => {
      applyLiveUpdate(payload, roomId);
    });

    socket.on("connect_error", () => {
      setStatusMessage("Socket connection failed. Check authentication/session.");
    });

    return () => {
      socket.emit("leaveRoom", roomId);
      socket.disconnect();
    };
  }, [dashboard?.room?.id, token]);

  const handleShiftLecture = async (event) => {
    event.preventDefault();

    if (!currentRoomId || !targetRoomId) {
      setShiftMessage("Select both current and target room.");
      return;
    }

    if (currentRoomId === targetRoomId) {
      setShiftMessage("Current room and target room cannot be the same.");
      return;
    }

    try {
      setIsShifting(true);
      setConflictInfo(null);
      const response = await apiClient.post("/api/teacher/shift-lecture", {
        currentRoomId,
        targetRoomId,
      });

      if (response.data?.conflict) {
        setConflictInfo(response.data);
        return;
      }

      setShiftMessage(response.data?.message || "Lecture shifted successfully.");
      setTargetRoomId("");
      await loadDashboard();
    } catch (error) {
      if (error.response?.data?.conflict) {
        setConflictInfo(error.response.data);
        return;
      }

      setShiftMessage(error.response?.data?.message || "Failed to shift lecture.");
    } finally {
      setIsShifting(false);
    }
  };

  const summary = dashboard?.summary || {
    totalStudents: 0,
    present: 0,
    absent: 0,
    flagged: 0,
    insideNow: 0,
  };

  const summaryCards = useMemo(
    () => [
      { label: "Total Students", value: summary.totalStudents, variant: "neutral" },
      { label: "Present", value: summary.present, variant: "present" },
      { label: "Absent", value: summary.absent, variant: "absent" },
      { label: "Flagged", value: summary.flagged, variant: "flagged" },
      { label: "Inside Now", value: summary.insideNow, variant: "inside" },
    ],
    [summary]
  );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <section className="mx-auto w-full max-w-7xl space-y-6">
        <article className="rounded-xl bg-white p-6 shadow">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Teacher Dashboard</h1>
              <p className="mt-1 text-sm text-slate-600">
                Real-time attendance stream via Socket.IO.
              </p>
              <p className="mt-2 text-sm">
                <Link to="/rooms/status" className="font-medium text-slate-900 underline">
                  View global room status
                </Link>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="sectionInput">
                Section
              </label>
              <input
                id="sectionInput"
                value={section}
                onChange={(event) => setSection(event.target.value)}
                className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Active Class</p>
              {dashboard?.activeClass ? (
                <>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {dashboard.activeClass.subject}
                  </p>
                  <p className="text-sm text-slate-600">
                    {dashboard.activeClass.dayOfWeek} | {dashboard.activeClass.startTime} -{" "}
                    {dashboard.activeClass.endTime}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-600">No active class for this section.</p>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Room</p>
              {dashboard?.room ? (
                <>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{dashboard.room.name}</p>
                  <p className="text-sm text-slate-600">Floor: {dashboard.room.floor ?? "N/A"}</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-600">No room assigned.</p>
              )}
            </div>
          </div>
        </article>

        <article className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-slate-900">Shift Lecture</h2>
          <p className="mt-1 text-sm text-slate-600">
            Move the currently active class to another room if it is available.
          </p>

          <form onSubmit={handleShiftLecture} className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="currentRoom">
                Current Room
              </label>
              <select
                id="currentRoom"
                value={currentRoomId}
                onChange={(event) => setCurrentRoomId(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              >
                <option value="">Select room</option>
                {rooms.map((room) => (
                  <option key={room._id} value={room._id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="targetRoom">
                Target Room
              </label>
              <select
                id="targetRoom"
                value={targetRoomId}
                onChange={(event) => setTargetRoomId(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              >
                <option value="">Select room</option>
                {rooms.map((room) => (
                  <option key={room._id} value={room._id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={isShifting}
                className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isShifting ? "Shifting..." : "Shift Now"}
              </button>
            </div>
          </form>

          {dashboard?.activeClass && (
            <p className="mt-3 text-sm text-slate-700">
              Active class: {dashboard.activeClass.subject} ({dashboard.activeClass.startTime} -{" "}
              {dashboard.activeClass.endTime})
            </p>
          )}
          {shiftMessage && <p className="mt-2 text-sm text-slate-700">{shiftMessage}</p>}
        </article>

        <article className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-xl bg-white p-4 shadow">
              <p className="text-xs uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
              {card.variant !== "neutral" && (
                <div className="mt-3">
                  <StatusBadge label={card.label} variant={card.variant} />
                </div>
              )}
            </div>
          ))}
        </article>

        <article className="overflow-hidden rounded-xl bg-white shadow">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Live Student Attendance</h2>
            <p className="mt-1 text-sm text-slate-600">{statusMessage}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-6 py-3 font-semibold">Student Name</th>
                  <th className="px-6 py-3 font-semibold">Inside / Outside</th>
                  <th className="px-6 py-3 font-semibold">Inside Time (min)</th>
                  <th className="px-6 py-3 font-semibold">Boundary Crossings</th>
                  <th className="px-6 py-3 font-semibold">Final Status</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.attendanceRecords || []).map((record) => (
                  <tr key={record.studentId} className="border-t border-slate-100">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{record.name}</p>
                      <p className="text-xs text-slate-500">{record.section}</p>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge
                        label={record.insideNow ? "Inside" : "Outside"}
                        variant={record.insideNow ? "inside" : "outside"}
                      />
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {(record.insideTime || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-slate-700">{record.boundaryCrossings || 0}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          label={record.status || "Pending"}
                          variant={getStatusVariant(record.status, record.isSuspicious)}
                        />
                        {record.isSuspicious && <StatusBadge label="Suspicious" variant="flagged" />}
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoading && (dashboard?.attendanceRecords || []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                      No attendance records found for section {section}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      {conflictInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">Room Occupied</h3>
            <p className="mt-3 text-sm text-slate-700">
              Room occupied by Section {conflictInfo.section || "Unknown"} (Teacher{" "}
              {conflictInfo.teacherName || "Unknown"}) from {conflictInfo.startTime || "--:--"} to{" "}
              {conflictInfo.endTime || "--:--"}.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setConflictInfo(null)}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
