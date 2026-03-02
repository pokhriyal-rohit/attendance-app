const User = require("../models/User");
const { verifyToken } = require("../utils/jwt");

const extractToken = (authorizationHeader) => {
  if (typeof authorizationHeader !== "string") {
    return null;
  }

  if (!authorizationHeader.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice(7).trim();
};

const protect = async (req, res, next) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ message: "Missing or invalid auth token" });
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id)
      .select("_id name email role section")
      .lean();

    if (!user) {
      return res.status(401).json({ message: "User not found for token" });
    }

    req.user = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      section: user.section,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized token" });
  }
};

const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden for this role" });
  }

  return next();
};

module.exports = { protect, authorize };
