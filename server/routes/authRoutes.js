const express = require("express");
const passport = require("passport");
const {
  register,
  login,
  forgotPassword,
  resetPassword,
  googleAuthSuccess,
} = require("../controllers/authController");

const router = express.Router();
const getFrontendUrl = () => {
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }

  if (process.env.NODE_ENV === "production") {
    return "";
  }

  return "http://localhost:5173";
};

const ensureGoogleOAuthConfigured = (req, res, next) => {
  const isGoogleOAuthConfigured =
    Boolean(process.env.GOOGLE_CLIENT_ID) &&
    Boolean(process.env.GOOGLE_CLIENT_SECRET) &&
    Boolean(process.env.GOOGLE_CALLBACK_URL);
  if (!isGoogleOAuthConfigured) {
    return res.status(503).json({ message: "Google OAuth is not configured on server" });
  }
  return next();
};

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get(
  "/google",
  ensureGoogleOAuthConfigured,
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/google/callback",
  ensureGoogleOAuthConfigured,
  (req, res, next) => {
    passport.authenticate("google", (error, user) => {
      if (error || !user) {
        const frontendUrl = getFrontendUrl();
        if (!frontendUrl) {
          return res.status(500).json({ message: "FRONTEND_URL is not configured" });
        }
        return res.redirect(`${frontendUrl}/oauth/callback?error=google_auth_failed`);
      }

      req.user = user;
      return googleAuthSuccess(req, res, next);
    })(req, res, next);
  }
);

module.exports = router;
