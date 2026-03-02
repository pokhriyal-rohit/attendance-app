import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/client";
import StatusBadge from "../components/StatusBadge";

const EMPTY_ATTENDANCE = {
  totalRecords: 0,
  present: 0,
  absent: 0,
  flagged: 0,
  suspicious: 0,
};

const EMPTY_ROOM_FORM = {
  id: "",
  name: "",
  floor: "",
  coordinatesText: "",
};

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

const toCoordinatesText = (polygonCoordinates) =>
  (Array.isArray(polygonCoordinates) ? polygonCoordinates : [])
    .map((point) => `${point?.lat ?? ""},${point?.lng ?? ""}`)
    .join("\n");

const parseCoordinatesText = (value) => {
  const lines = String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 3) {
    return { error: "At least 3 coordinate points are required." };
  }

  const polygonCoordinates = [];
  for (const line of lines) {
    const [latRaw, lngRaw] = line.split(",").map((part) => part.trim());
    const lat = Number(latRaw);
    const lng = Number(lngRaw);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      return { error: `Invalid coordinate format: "${line}"` };
    }

    polygonCoordinates.push({ lat, lng });
  }

  return { polygonCoordinates };
};

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState(EMPTY_ATTENDANCE);
  const [flaggedStudents, setFlaggedStudents] = useState([]);
  const [statusMessage, setStatusMessage] = useState("Loading admin dashboard...");
  const [isLoading, setIsLoading] = useState(true);
  const [activeUserId, setActiveUserId] = useState("");
  const [roomForm, setRoomForm] = useState(EMPTY_ROOM_FORM);
  const [activeRoomId, setActiveRoomId] = useState("");

  const loadUsers = async () => {
    const response = await apiClient.get("/api/admin/users");
    setUsers(response.data?.users || []);
  };

  const loadRooms = async () => {
    const response = await apiClient.get("/api/admin/rooms");
    setRooms(response.data?.rooms || []);
  };

  const loadAttendance = async () => {
    const response = await apiClient.get("/api/admin/attendance");
    setAttendanceSummary({
      ...EMPTY_ATTENDANCE,
      ...(response.data?.summary || {}),
    });
    setFlaggedStudents(response.data?.flaggedStudents || []);
  };

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setIsLoading(true);
        await Promise.all([loadUsers(), loadRooms(), loadAttendance()]);
        setStatusMessage("Admin dashboard updated.");
      } catch (error) {
        setStatusMessage(error.response?.data?.message || "Failed to load admin dashboard.");
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const resetRoomForm = () => {
    setRoomForm(EMPTY_ROOM_FORM);
    setActiveRoomId("");
  };

  const startRoomEdit = (room) => {
    setRoomForm({
      id: room.id,
      name: room.name || "",
      floor:
        typeof room.floor === "number" && Number.isFinite(room.floor)
          ? String(room.floor)
          : "",
      coordinatesText: toCoordinatesText(room.polygonCoordinates),
    });
  };

  const handleRoomSubmit = async (event) => {
    event.preventDefault();
    const trimmedName = roomForm.name.trim();
    if (!trimmedName) {
      setStatusMessage("Room name is required.");
      return;
    }

    const { polygonCoordinates, error } = parseCoordinatesText(roomForm.coordinatesText);
    if (error) {
      setStatusMessage(error);
      return;
    }

    const payload = {
      name: trimmedName,
      polygonCoordinates,
    };

    if (roomForm.floor.trim() !== "") {
      const floorValue = Number(roomForm.floor);
      if (!Number.isFinite(floorValue)) {
        setStatusMessage("Floor must be a valid number.");
        return;
      }
      payload.floor = floorValue;
    }

    try {
      setActiveRoomId(roomForm.id || "new");
      if (roomForm.id) {
        await apiClient.put(`/api/admin/rooms/${roomForm.id}`, payload);
        setStatusMessage("Room updated successfully.");
      } else {
        await apiClient.post("/api/admin/rooms", payload);
        setStatusMessage("Room created successfully.");
      }

      await loadRooms();
      resetRoomForm();
    } catch (apiError) {
      setStatusMessage(apiError.response?.data?.message || "Failed to save room.");
    } finally {
      setActiveRoomId("");
    }
  };

  const handleDeleteRoom = async (roomId) => {
    const confirmed = window.confirm("Delete this room?");
    if (!confirmed) {
      return;
    }

    try {
      setActiveRoomId(String(roomId));
      await apiClient.delete(`/api/admin/rooms/${roomId}`);
      await loadRooms();
      setStatusMessage("Room deleted successfully.");
      if (roomForm.id && String(roomForm.id) === String(roomId)) {
        resetRoomForm();
      }
    } catch (error) {
      setStatusMessage(error.response?.data?.message || "Failed to delete room.");
    } finally {
      setActiveRoomId("");
    }
  };

  const handleRoleChange = async (userId, role) => {
    try {
      setActiveUserId(userId);
      await apiClient.put(`/api/admin/users/${userId}/role`, { role });
      setUsers((prev) =>
        prev.map((user) => (String(user._id) === String(userId) ? { ...user, role } : user))
      );
      setStatusMessage("User role updated.");
    } catch (error) {
      setStatusMessage(error.response?.data?.message || "Failed to update role.");
    } finally {
      setActiveUserId("");
    }
  };

  const handleDeleteUser = async (userId) => {
    const confirmed = window.confirm("Delete this user?");
    if (!confirmed) {
      return;
    }

    try {
      setActiveUserId(userId);
      await apiClient.delete(`/api/admin/users/${userId}`);
      setUsers((prev) => prev.filter((user) => String(user._id) !== String(userId)));
      await loadAttendance();
      setStatusMessage("User deleted.");
    } catch (error) {
      setStatusMessage(error.response?.data?.message || "Failed to delete user.");
    } finally {
      setActiveUserId("");
    }
  };

  const summaryCards = useMemo(
    () => [
      { label: "Attendance Records", value: attendanceSummary.totalRecords },
      { label: "Present", value: attendanceSummary.present },
      { label: "Absent", value: attendanceSummary.absent },
      { label: "Flagged", value: attendanceSummary.flagged },
      { label: "Suspicious", value: attendanceSummary.suspicious },
      { label: "Total Rooms", value: rooms.length },
    ],
    [attendanceSummary, rooms.length]
  );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <section className="mx-auto w-full max-w-7xl space-y-6">
        <article className="rounded-xl bg-white p-6 shadow">
          <h1 className="text-2xl font-semibold text-slate-900">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            User governance, room management, and attendance oversight.
          </p>
          <p className="mt-2 text-sm">
            <Link to="/rooms/status" className="font-medium text-slate-900 underline">
              View global room status
            </Link>
          </p>
          <p className="mt-3 text-sm text-slate-700">{statusMessage}</p>
        </article>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} label={card.label} value={isLoading ? "-" : card.value} />
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-slate-900">Manage Rooms</h2>
            <p className="mt-1 text-sm text-slate-600">
              Enter coordinates line-by-line as lat,lng.
            </p>

            <form onSubmit={handleRoomSubmit} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="roomName">
                  Room Name
                </label>
                <input
                  id="roomName"
                  value={roomForm.name}
                  onChange={(event) =>
                    setRoomForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                  placeholder="Room 101"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="roomFloor">
                  Floor
                </label>
                <input
                  id="roomFloor"
                  value={roomForm.floor}
                  onChange={(event) =>
                    setRoomForm((prev) => ({ ...prev, floor: event.target.value }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                  placeholder="1"
                />
              </div>

              <div>
                <label
                  className="mb-1 block text-sm font-medium text-slate-700"
                  htmlFor="roomCoordinates"
                >
                  Coordinates
                </label>
                <textarea
                  id="roomCoordinates"
                  rows={7}
                  value={roomForm.coordinatesText}
                  onChange={(event) =>
                    setRoomForm((prev) => ({ ...prev, coordinatesText: event.target.value }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                  placeholder={"28.6139,77.2090\n28.6143,77.2094\n28.6135,77.2099"}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={activeRoomId === "new" || (roomForm.id && activeRoomId === roomForm.id)}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {roomForm.id ? "Update Room" : "Create Room"}
                </button>
                {roomForm.id && (
                  <button
                    type="button"
                    onClick={resetRoomForm}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>

            <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Room</th>
                    <th className="px-4 py-3 font-semibold">Floor</th>
                    <th className="px-4 py-3 font-semibold">Points</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-900">{room.name}</td>
                      <td className="px-4 py-3 text-slate-700">{room.floor ?? "N/A"}</td>
                      <td className="px-4 py-3 text-slate-700">{room.polygonPointCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startRoomEdit(room)}
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRoom(room.id)}
                            disabled={activeRoomId === String(room.id)}
                            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!isLoading && rooms.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                        No rooms available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="overflow-hidden rounded-xl bg-white shadow">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Flagged Students</h2>
            </div>
            <div className="max-h-[620px] overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Student</th>
                    <th className="px-6 py-3 font-semibold">Section</th>
                    <th className="px-6 py-3 font-semibold">Flag Count</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {flaggedStudents.map((student) => (
                    <tr key={student.studentId} className="border-t border-slate-100">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">{student.name}</p>
                        <p className="text-xs text-slate-500">{student.email}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-700">{student.section || "N/A"}</td>
                      <td className="px-6 py-4 text-slate-700">{student.flaggedCount}</td>
                      <td className="px-6 py-4">
                        <StatusBadge label={student.lastStatus || "Flagged"} variant="flagged" />
                      </td>
                    </tr>
                  ))}
                  {!isLoading && flaggedStudents.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                        No flagged students found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>

        <article className="overflow-hidden rounded-xl bg-white shadow">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Manage Users</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-6 py-3 font-semibold">Name</th>
                  <th className="px-6 py-3 font-semibold">Email</th>
                  <th className="px-6 py-3 font-semibold">Role</th>
                  <th className="px-6 py-3 font-semibold">Section</th>
                  <th className="px-6 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id} className="border-t border-slate-100">
                    <td className="px-6 py-4 font-medium text-slate-900">{user.name}</td>
                    <td className="px-6 py-4 text-slate-700">{user.email}</td>
                    <td className="px-6 py-4">
                      <select
                        value={user.role}
                        onChange={(event) => handleRoleChange(user._id, event.target.value)}
                        disabled={activeUserId === String(user._id)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500 disabled:opacity-60"
                      >
                        <option value="student">student</option>
                        <option value="teacher">teacher</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{user.section || "-"}</td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(user._id)}
                        disabled={activeUserId === String(user._id)}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {!isLoading && users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </main>
  );
}
