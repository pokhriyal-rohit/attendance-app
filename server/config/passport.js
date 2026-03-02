const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const passportGoogle = require("passport-google-oauth20");
const User = require("../models/User");
const { sanitizeEmail, sanitizeString } = require("../utils/validation");

const { Strategy: GoogleStrategy } = passportGoogle;
const configuredSaltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
const SALT_ROUNDS = Number.isFinite(configuredSaltRounds)
  ? Math.max(10, Math.floor(configuredSaltRounds))
  : 10;

const createDefaultPasswordHash = async () => {
  const randomPassword = crypto.randomBytes(32).toString("hex");
  return bcrypt.hash(randomPassword, SALT_ROUNDS);
};

const configurePassport = (passport) => {
  passport.serializeUser((user, done) => {
    done(null, String(user._id));
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id).select("_id name email role section");
      done(null, user || false);
    } catch (error) {
      done(error);
    }
  });

  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL = process.env.GOOGLE_CALLBACK_URL;
  if (!clientID || !clientSecret || !callbackURL) {
    return false;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = sanitizeEmail(profile?.emails?.[0]?.value);
          if (!email) {
            return done(new Error("Google account email is required"));
          }

          let user = await User.findOne({ email });
          if (!user) {
            const password = await createDefaultPasswordHash();
            const displayName = sanitizeString(profile?.displayName || "", 120);
            const fallbackName = email.split("@")[0] || "Student";

            user = await User.create({
              name: displayName || fallbackName,
              email,
              password,
              role: "student",
              section: "",
            });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  return true;
};

module.exports = configurePassport;
