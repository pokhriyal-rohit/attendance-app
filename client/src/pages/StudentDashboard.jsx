import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/client";
import MapView from "../components/MapView";
import StatusBadge from "../components/StatusBadge";
import { getAuthSession } from "../utils/auth";

export default function StudentDashboard() {
  const session = getAuthSession();
  const studentId = session?.user?.id;

  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [statusMessage, setStatusMessage] = useState("Initializing geolocation...");
  const [inside, setInside] = useState(null);
  const [roomName, setRoomName] = useState("");
  const [polygonCoordinates, setPolygonCoordinates] = useState([]);
  const [isSuspicious, setIsSuspicious] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatusMessage("Geolocation not supported.");
      return undefined;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
      },
      () => {
        setStatusMessage("Unable to fetch location.");
      },
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!studentId || latitude === null || longitude === null) {
      return undefined;
    }

    const sendAttendance = async () => {
      try {
        const response = await apiClient.post("/api/attendance/track", {
          studentId,
          latitude,
          longitude,
        });

        setInside(response.data.inside ?? null);
        setStatusMessage(response.data.message || "No response");
        setRoomName(response.data.room?.name || "");
        setPolygonCoordinates(response.data.room?.polygonCoordinates || []);
        setIsSuspicious(Boolean(response.data.attendance?.isSuspicious));
      } catch (error) {
        setStatusMessage(error.response?.data?.message || "Failed to send attendance.");
      }
    };

    sendAttendance();
    const interval = setInterval(sendAttendance, 15000);
    return () => clearInterval(interval);
  }, [studentId, latitude, longitude]);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <section className="mx-auto w-full max-w-3xl">
        <article className="rounded-xl bg-white p-6 shadow">
          <h1 className="text-2xl font-semibold text-slate-900">Student Attendance</h1>
          <p className="mt-2 text-sm text-slate-600">
            Secure geo-fenced tracking with anti-spoof monitoring.
          </p>
          <p className="mt-2 text-sm">
            <Link to="/student/analytics" className="font-medium text-slate-900 underline">
              View attendance analytics
            </Link>
          </p>
          <p className="mt-1 text-sm">
            <Link to="/rooms/status" className="font-medium text-slate-900 underline">
              View room status
            </Link>
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <StatusBadge
              label={inside === null ? "Pending" : inside ? "Inside" : "Outside"}
              variant={inside === null ? "pending" : inside ? "inside" : "outside"}
            />
            {isSuspicious && <StatusBadge label="Suspicious" variant="flagged" />}
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="text-slate-700">{statusMessage}</p>
            <p className="mt-2 text-xs text-slate-500">Student ID: {studentId || "Unknown"}</p>
            <p className="mt-1 text-xs text-slate-500">
              Room: {roomName || "Waiting for active class"}
            </p>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
            <p>Latitude: {latitude ?? "Fetching..."}</p>
            <p>Longitude: {longitude ?? "Fetching..."}</p>
          </div>

          <div className="mt-6">
            <MapView
              latitude={latitude}
              longitude={longitude}
              polygonCoordinates={polygonCoordinates}
              inside={inside}
            />
          </div>
        </article>
      </section>
    </main>
  );
}
