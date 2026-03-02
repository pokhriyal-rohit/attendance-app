const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const { signToken } = require("../utils/jwt");
const { sendEmail } = require("../utils/emailService");
const { sanitizeString, sanitizeEmail, isValidRole } = require("../utils/validation");

const configuredSaltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
const SALT_ROUNDS = Number.isFinite(configuredSaltRounds)
  ? Math.max(10, Math.floor(configuredSaltRounds))
  : 10;
const FORGOT_PASSWORD_MESSAGE = "If the email exists, a reset link has been sent";

const getClientIpAddress = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || "";
};

const getClientDevice = (req) =>
  sanitizeString(req.headers["user-agent"] || "unknown", 250);

const recordLoginFingerprint = async (user, req) => {
  const nextIP = getClientIpAddress(req);
  const nextDevice = getClientDevice(req);

  const suspiciousFingerprintChange =
    (user.lastLoginIP && nextIP && user.lastLoginIP !== nextIP) ||
    (user.lastLoginDevice && nextDevice && user.lastLoginDevice !== nextDevice);

  if (suspiciousFingerprintChange) {
    console.warn("Security warning: login fingerprint changed", {
      userId: String(user._id),
    });
  }

  user.lastLoginIP = nextIP;
  user.lastLoginDevice = nextDevice;
  await user.save();
};

const shapeAuthResponse = (user) => {
  const safeUser = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    section: user.section || "",
  };

  const token = signToken({
    id: String(user._id),
    name: user.name,
    role: user.role,
    email: user.email,
    section: user.section || "",
  });

  return {
    token,
    user: safeUser,
    expiresIn: 7 * 24 * 60 * 60,
  };
};

const getFrontendUrl = () => process.env.FRONTEND_URL || "http://localhost:5173";

const register = async (req, res) => {
  try {
    const name = sanitizeString(req.body.name, 120);
    const email = sanitizeEmail(req.body.email);
    const password = sanitizeString(req.body.password, 200);
    const role = sanitizeString(req.body.role, 20).toLowerCase();
    const section = sanitizeString(req.body.section, 50);

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "name, email, password and role are required" });
    }

    if (!isValidRole(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ email }).select("_id").lean();
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      section: role === "student" ? section : section || "",
    });

    return res.status(201).json(shapeAuthResponse(user));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to register user" });
  }
};

const login = async (req, res) => {
  try {
    const email = sanitizeEmail(req.body.email);
    const password = sanitizeString(req.body.password, 200);

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    await recordLoginFingerprint(user, req);

    return res.json(shapeAuthResponse(user));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to login user" });
  }
};

const forgotPassword = async (req, res) => {
  const email = sanitizeEmail(req.body.email);

  if (!email) {
    return res.json({ message: FORGOT_PASSWORD_MESSAGE });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: FORGOT_PASSWORD_MESSAGE });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiry = new Date(Date.now() + 30 * 60 * 1000);

    user.resetToken = hashedToken;
    user.resetTokenExpiry = expiry;
    await user.save();

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetLink = `${frontendUrl}/reset-password/${rawToken}`;

    try {
      if (process.env.NODE_ENV !== "production") {
        console.log("Sending reset email to:", email);
      }

      await sendEmail({
        to: user.email,
        subject: "Password Reset - Smart Attendance",
        text: `Reset your password using this link: ${resetLink}\n\nThis link expires in 30 minutes.`,
      });
    } catch (mailError) {
      user.resetToken = undefined;
      user.resetTokenExpiry = undefined;
      await user.save();
      console.error("Forgot password email delivery failed:", mailError.message);
      return res.json({ message: FORGOT_PASSWORD_MESSAGE });
    }

    return res.json({ message: FORGOT_PASSWORD_MESSAGE });
  } catch (error) {
    console.error("Forgot password request failed:", error.message);
    return res.json({ message: FORGOT_PASSWORD_MESSAGE });
  }
};

const resetPassword = async (req, res) => {
  try {
    const token = sanitizeString(req.body.token, 500);
    const password = sanitizeString(req.body.password, 200);

    if (!token || !password) {
      return res.status(400).json({ message: "Token and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetToken: hashedToken,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    user.password = await bcrypt.hash(password, SALT_ROUNDS);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    return res.json({ message: "Password reset successful. Please login." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to reset password" });
  }
};

const googleAuthSuccess = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect(
        `${getFrontendUrl()}/oauth/callback?error=${encodeURIComponent(
          "google_auth_failed"
        )}`
      );
    }

    await recordLoginFingerprint(req.user, req);
    const authResponse = shapeAuthResponse(req.user);
    return res.redirect(
      `${getFrontendUrl()}/oauth/callback?token=${encodeURIComponent(authResponse.token)}`
    );
  } catch (error) {
    console.error(error);
    return res.redirect(
      `${getFrontendUrl()}/oauth/callback?error=${encodeURIComponent("google_auth_failed")}`
    );
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  googleAuthSuccess,
};
