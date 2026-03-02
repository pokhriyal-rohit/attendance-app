import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { setAuthSession } from "../utils/auth";

const decodeBase64Url = (value) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(padded);
};

const parseJwtPayload = (token) => {
  try {
    const segments = token.split(".");
    if (segments.length !== 3) {
      return null;
    }
    return JSON.parse(decodeBase64Url(segments[1]));
  } catch (error) {
    return null;
  }
};

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [statusMessage, setStatusMessage] = useState("Completing Google sign-in...");

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      setStatusMessage("Google authentication failed. Please try again.");
      return;
    }

    const token = searchParams.get("token");
    if (!token) {
      setStatusMessage("Missing authentication token.");
      return;
    }

    const payload = parseJwtPayload(token);
    if (!payload?.id || !payload?.email || !payload?.role) {
      setStatusMessage("Invalid authentication response.");
      return;
    }

    const user = {
      id: String(payload.id),
      name: payload.name || payload.email.split("@")[0] || "User",
      email: payload.email,
      role: payload.role,
      section: payload.section || "",
    };

    setAuthSession({ token, user });
    setStatusMessage("Google authentication successful. Redirecting...");

    if (user.role === "admin") {
      navigate("/admin", { replace: true });
      return;
    }

    if (user.role === "teacher") {
      navigate("/teacher", { replace: true });
      return;
    }

    navigate("/student", { replace: true });
  }, [navigate, searchParams]);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <section className="mx-auto w-full max-w-md rounded-xl bg-white p-6 text-center shadow">
        <h1 className="text-2xl font-semibold text-slate-900">Google Sign-In</h1>
        <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{statusMessage}</p>
        <p className="mt-4 text-sm text-slate-600">
          <Link className="font-medium text-slate-900 underline" to="/">
            Back to Login
          </Link>
        </p>
      </section>
    </main>
  );
}
