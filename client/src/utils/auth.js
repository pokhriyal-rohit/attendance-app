const AUTH_STORAGE_KEY = "smartAttendanceAuth";

const decodeBase64Url = (value) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(padded);
};

const parseJwtPayload = (token) => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }
    return JSON.parse(decodeBase64Url(parts[1]));
  } catch (error) {
    return null;
  }
};

export const getAuthSession = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

export const setAuthSession = ({ token, user }) => {
  const payload = parseJwtPayload(token);
  const expiresAt = payload?.exp ? payload.exp * 1000 : Date.now() + 24 * 60 * 60 * 1000;

  const session = {
    token,
    user,
    expiresAt,
  };

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  return session;
};

export const clearAuthSession = () => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const isSessionExpired = (session = getAuthSession()) => {
  if (!session || !session.expiresAt) {
    return true;
  }
  return Date.now() >= session.expiresAt;
};
