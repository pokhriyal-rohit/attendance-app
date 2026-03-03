const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
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

const runtimeNodeEnv = process.env.NODE_ENV || "development";
const isProduction = runtimeNodeEnv === "production";

if (!isProduction) {
  require("dotenv").config({ path: path.join(__dirname, ".env") });
}

const validateProductionEnvironment = () => {
  if (!isProduction) {
    return;
  }

  console.debug = () => {};

  const requiredEnvVariables = [
    "NODE_ENV",
    "MONGODB_URI",
    "JWT_SECRET",
    "SESSION_SECRET",
    "FRONTEND_URL",
  ];

  const missingVariables = requiredEnvVariables.filter(
    (name) => !process.env[name],
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required environment variables in production: ${missingVariables.join(", ")}`,
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
    (name) => !process.env[name],
  );

  if (hasMissingSmtpConfig) {
    throw new Error("SMTP configuration is missing");
  }

  const parsedSmtpPort = Number(process.env.SMTP_PORT);
  if (!Number.isFinite(parsedSmtpPort) || parsedSmtpPort <= 0) {
    throw new Error("SMTP configuration is missing");
  }

  const googleEnvVariables = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_CALLBACK_URL",
  ];

  const configuredGoogleEnvCount = googleEnvVariables.filter(
    (name) => Boolean(process.env[name]),
  ).length;

  if (
    configuredGoogleEnvCount > 0 &&
    configuredGoogleEnvCount < googleEnvVariables.length
  ) {
    throw new Error("Google OAuth not configured properly");
  }
};

validateProductionEnvironment();

const app = express();
const server = http.createServer(app);

app.disable("x-powered-by");

const PORT = process.env.PORT || 5000;

const sessionSecret =
  process.env.SESSION_SECRET ||
  process.env.JWT_SECRET ||
  "dev_session_secret_change_me_before_production";

const isGoogleOAuthConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET) &&
  Boolean(process.env.GOOGLE_CALLBACK_URL);

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
  "Too many authentication requests. Please try again later.",
);

const attendanceLimiter = createApiLimiter(
  300,
  15 * 60 * 1000,
  "Too many attendance requests. Please try again later.",
);

const adminLimiter = createApiLimiter(
  120,
  15 * 60 * 1000,
  "Too many admin requests. Please try again later.",
);

/* ================= MIDDLEWARE ================= */

app.use(cors(corsOptions));
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: "1mb" }));

if (isProduction) {
  app.set("trust proxy", 1);
}

if (isGoogleOAuthConfigured) {
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
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());
} else {
  app.use(passport.initialize());
}

/* ================= ROUTES ================= */

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

/* ================= STATIC FRONTEND ================= */

if (isProduction) {
  const clientDistPath = path.join(__dirname, "../client/dist");
  app.use(express.static(clientDistPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

/* ================= START SERVER ================= */

let hasStarted = false;

const startServer = async () => {
  if (hasStarted) {
    return;
  }

  try {
    hasStarted = true;
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

    server.on("error", (error) => {
      if (error?.code === "EADDRINUSE") {
        console.error(`Server startup failed: port ${PORT} is already in use`);
      } else {
        console.error("Server runtime error:", error.message);
      }
      process.exit(1);
    });

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    hasStarted = false;
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();

/* ================= CRASH HANDLERS ================= */

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});
