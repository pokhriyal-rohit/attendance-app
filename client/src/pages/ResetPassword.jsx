import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import apiClient from "../api/client";

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

export default function ResetPassword() {
  const { token } = useParams();
  const safeToken = useMemo(() => (typeof token === "string" ? token.trim() : ""), [token]);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "Set a new password with at least 6 characters."
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!safeToken) {
      setStatusMessage("Invalid reset token.");
      return;
    }

    if (!password || password.length < 6) {
      setStatusMessage("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setStatusMessage("Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await apiClient.post("/api/auth/reset-password", {
        token: safeToken,
        password,
      });
      setIsSuccess(true);
      setStatusMessage(response.data?.message || "Password reset successful.");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setStatusMessage(error.response?.data?.message || "Failed to reset password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <section className="mx-auto w-full max-w-md rounded-xl bg-white p-6 shadow">
        <h1 className="text-2xl font-semibold text-slate-900">Reset Password</h1>
        <p className="mt-2 text-sm text-slate-600">Create a new password for your account.</p>

        {!isSuccess && (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
                New Password
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

            <div>
              <label
                className="mb-1 block text-sm font-medium text-slate-700"
                htmlFor="confirmPassword"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm outline-none focus:border-slate-500"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  <PasswordToggleIcon visible={showConfirmPassword} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}

        <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{statusMessage}</p>

        <p className="mt-4 text-center text-sm text-slate-600">
          <Link className="font-medium text-slate-900 underline" to="/">
            Back to Login
          </Link>
        </p>
      </section>
    </main>
  );
}
