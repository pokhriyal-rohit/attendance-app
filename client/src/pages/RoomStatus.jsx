import { useEffect, useState } from "react";
import apiClient from "../api/client";
import StatusBadge from "../components/StatusBadge";

export default function RoomStatus() {
  const [rooms, setRooms] = useState([]);
  const [statusMessage, setStatusMessage] = useState("Loading room occupancy...");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    const loadRoomStatus = async () => {
      try {
        const response = await apiClient.get("/api/rooms/status");
        if (isCancelled) {
          return;
        }

        setRooms(Array.isArray(response.data) ? response.data : []);
        setStatusMessage("Live room occupancy updated.");
      } catch (error) {
        if (!isCancelled) {
          setStatusMessage(
            error.response?.data?.message || "Failed to fetch room occupancy status."
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadRoomStatus();
    const interval = setInterval(loadRoomStatus, 15000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <section className="mx-auto w-full max-w-7xl space-y-6">
        <article className="rounded-xl bg-white p-6 shadow">
          <h1 className="text-2xl font-semibold text-slate-900">Room Status</h1>
          <p className="mt-1 text-sm text-slate-600">
            Global live occupancy across classrooms.
          </p>
          <p className="mt-3 text-sm text-slate-700">{statusMessage}</p>
        </article>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <article key={room.roomId} className="rounded-xl bg-white p-5 shadow">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">{room.roomName}</h2>
                <StatusBadge
                  label={room.occupied ? "Occupied" : "Available"}
                  variant={room.occupied ? "outside" : "present"}
                />
              </div>

              {room.occupied ? (
                <div className="mt-4 space-y-1 text-sm text-slate-700">
                  <p>Section: {room.section || "Unknown"}</p>
                  <p>Teacher: {room.teacherName || "Unknown"}</p>
                  <p>
                    Time: {room.startTime || "--:--"} - {room.endTime || "--:--"}
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-600">No active class in this room.</p>
              )}
            </article>
          ))}

          {!isLoading && rooms.length === 0 && (
            <article className="rounded-xl bg-white p-6 text-sm text-slate-600 shadow md:col-span-2 xl:col-span-3">
              No room records found.
            </article>
          )}
        </section>
      </section>
    </main>
  );
}
