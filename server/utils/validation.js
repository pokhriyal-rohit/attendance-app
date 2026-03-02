const sanitizeString = (value, maxLength = 200) => {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/[<>]/g, "")
    .slice(0, maxLength);
};

const sanitizeEmail = (value) => sanitizeString(value, 320).toLowerCase();

const isValidRole = (role) => ["student", "teacher", "admin"].includes(role);

const parseCoordinate = (value, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
};

module.exports = { sanitizeString, sanitizeEmail, isValidRole, parseCoordinate };
