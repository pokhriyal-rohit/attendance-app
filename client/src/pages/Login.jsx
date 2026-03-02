import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import { API_BASE } from "../config/api";
import { setAuthSession } from "../utils/auth";

function PasswordToggleIcon({ visible }) {
  return visible ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        fill="currentColor"
        d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l2.13 2.13A11.34 11.34 0 0 0 1.53 12a.75.75 0 0 0 0 .06A11.44 11.44 0 0 0 12 19.5a11.3 11.3 0 0 0 4.81-1.07l3.66 3.66a.75.75 0 1 0 1.06-1.06zM12 18a9.89 9.89 0 0 1-8.95-6 9.84 9.84 0 0 1 2.67-3.45l2.04 2.04a3.75 3.75 0 0 0 4.65 4.65l3.31 3.31A9.8 9.8 0 0 1 12 18Zm-2.75-6.75 3.5 3.5a2.25 2.25 0 0 1-3.5-3.5ZM12 6a9.81 9.81 0 0 1 8.95 6 9.98 9.98 0 0 1-2.15 3.04.75.75 0 0 0 1.07 1.04 11.54 11.54 0 0 0 2.58-3.99.8.8 0 0 0 0-.18A11.35 11.35 0 0 0 12 4.5a11.2 11.2 0 0 0-4.1.76.75.75 0 1 0 .55 1.4A9.76 9.76 0 0 1 12 6Z"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        fill="currentColor"
        d="M12 5.25A11.42 11.42 0 0 0 1.53 11.94a.8.8 0 0 0 0 .12A11.42 11.42 0 0 0 12 18.75a11.42 11.42 0 0 0 10.47-6.69.8.8 0 0 0 0-.12A11.42 11.42 0 0 0 12 5.25Zm0 12A9.9 9.9 0 0 1 3.05 12 9.9 9.9 0 0 1 12 6.75 9.9 9.9 0 0 1 20.95 12 9.9 9.9 0 0 1 12 17.25Zm0-8.25A3 3 0 1 0 15 12a3 3 0 0 0-3-3Zm0 4.5A1.5 1.5 0 1 1 13.5 12 1.5 1.5 0 0 1 12 13.5Z"
      />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const oauthLoginUrl = `${API_BASE}/api/auth/google`;
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("student");
  const [section, setSection] = useState("A1");
  const [statusMessage, setStatusMessage] = useState("Use your credentials to continue.");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const payload =
        mode === "register"
          ? { name, email, password, role, section }
          : { email, password };

      const response = await apiClient.post(endpoint, payload);
      const session = setAuthSession({
        token: response.data.token,
        user: response.data.user,
      });

      setStatusMessage("Authentication successful.");
      if (session.user.role === "teacher") {
        navigate("/teacher");
      } else if (session.user.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/student");
      }
    } catch (error) {
      setStatusMessage(
        error.response?.data?.message || "Authentication failed. Please check your details."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = oauthLoginUrl;
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <section className="mx-auto w-full max-w-md rounded-xl bg-white p-6 shadow">
        <h1 className="text-2xl font-semibold text-slate-900">Smart Attendance Auth</h1>
        <p className="mt-2 text-sm text-slate-600">
          Secure JWT login for student, teacher, and admin roles.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              mode === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              mode === "register" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
            }`}
          >
            Register
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {mode === "register" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                required
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm outline-none focus:border-slate-500"
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <PasswordToggleIcon visible={showPassword} />
              </button>
            </div>
          </div>

          {mode === "register" && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="role">
                  Role
                </label>
                <select
                  id="role"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="section">
                  Section
                </label>
                <input
                  id="section"
                  type="text"
                  value={section}
                  onChange={(event) => setSection(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                  required={role === "student"}
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Please wait..." : mode === "register" ? "Create Account" : "Login"}
          </button>
        </form>

        {mode === "login" && (
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="mt-3 w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Continue with Google
          </button>
        )}

        {mode === "login" && (
          <p className="mt-3 text-right text-sm">
            <Link className="font-medium text-slate-900 underline" to="/forgot-password">
              Forgot password?
            </Link>
          </p>
        )}

        <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{statusMessage}</p>
      </section>
    </main>
  );
}
