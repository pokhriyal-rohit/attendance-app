const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const session = require("express-session");
const passport = require("passport");
const rateLimit = require("express-rate-limit");
const path = require("path");
const connectDB = require("./config/db");
const configurePassport = require("./config/passport");
const authRoutes = require("./routes/authRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const studentRoutes = require("./routes/studentRoutes");
const roomRoutes = require("./routes/roomRoutes");
const teacherRoutes = require("./routes/teacherRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const adminRoutes = require("./routes/adminRoutes");
const testRoutes = require("./routes/testRoutes");
const { startAttendanceCron } = require("./cron/attendanceCron");
const { initSocket } = require("./utils/socket");
const { verifySmtpTransport } = require("./utils/emailService");

const isProduction = process.env.NODE_ENV === "production";
if (!isProduction) {
  require("dotenv").config({ path: path.join(__dirname, ".env") });
}

if (isProduction) {
  console.debug = () => {};

  const requiredEnvVariables = [
    "MONGODB_URI",
    "JWT_SECRET",
    "SESSION_SECRET",
    "FRONTEND_URL",
  ];

  const missingVariables = requiredEnvVariables.filter(
    (name) => !process.env[name]
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required environment variables in production: ${missingVariables.join(", ")}`
    );
  }

  const requiredSmtpVariables = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS",
    "SMTP_FROM",
  ];
  const hasMissingSmtpConfig = requiredSmtpVariables.some(
    (name) => !process.env[name]
  );
  if (hasMissingSmtpConfig) {
    throw new Error("SMTP configuration is missing");
  }

  const requiredGoogleVariables = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"];
  const hasMissingGoogleConfig = requiredGoogleVariables.some(
    (name) => !process.env[name]
  );
  if (hasMissingGoogleConfig) {
    throw new Error("Google OAuth not configured");
  }
}

const app = express();
const server = http.createServer(app);
app.disable("x-powered-by");

const PORT = process.env.PORT || 5000;
const sessionSecret =
  process.env.SESSION_SECRET ||
  process.env.JWT_SECRET ||
  "dev_session_secret_change_me_before_production";

const corsOptions = {
  origin: isProduction
    ? process.env.FRONTEND_URL
    : ["http://localhost:5173", "http://localhost:3000"],
  credentials: true,
};

configurePassport(passport);

const createApiLimiter = (maxRequests, windowMs, message) =>
  rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message },
  });

const authLimiter = createApiLimiter(
  100,
  15 * 60 * 1000,
  "Too many authentication requests. Please try again later."
);
const attendanceLimiter = createApiLimiter(
  300,
  15 * 60 * 1000,
  "Too many attendance requests. Please try again later."
);
const adminLimiter = createApiLimiter(
  120,
  15 * 60 * 1000,
  "Too many admin requests. Please try again later."
);

app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
if (isProduction) {
  app.set("trust proxy", 1);
}
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/attendance", attendanceLimiter, attendanceRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/admin", adminLimiter, adminRoutes);
app.use("/api/test", testRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "OK" });
});

if (isProduction) {
  const clientDistPath = path.join(__dirname, "../client/dist");
  app.use(express.static(clientDistPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

const startServer = async () => {
  try {
    await connectDB();

    if (!isProduction) {
      try {
        await verifySmtpTransport();
        console.log("SMTP server ready");
      } catch (smtpError) {
        console.error("SMTP verification failed:", smtpError.message);
      }
    }

    initSocket(server);
    startAttendanceCron();

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
