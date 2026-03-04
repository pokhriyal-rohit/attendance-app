const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || "").trim();
const normalizedConfiguredApiBase = configuredApiBase.replace(/\/+$/, "");

export const API_BASE =
  normalizedConfiguredApiBase ||
  (import.meta.env.DEV ? "http://localhost:5000" : "");
