import { useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [statusMessage, setStatusMessage] = useState(
    "Enter your account email to receive a password reset link."
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setStatusMessage("Email is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await apiClient.post("/api/auth/forgot-password", {
        email: trimmedEmail,
      });
      setStatusMessage(
        response.data?.message || "If account exists, reset link has been sent."
      );
    } catch (error) {
      setStatusMessage(error.response?.data?.message || "Failed to process request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <section className="mx-auto w-full max-w-md rounded-xl bg-white p-6 shadow">
        <h1 className="text-2xl font-semibold text-slate-900">Forgot Password</h1>
        <p className="mt-2 text-sm text-slate-600">Reset your account using email verification.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

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
