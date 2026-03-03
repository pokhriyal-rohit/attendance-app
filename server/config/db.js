const mongoose = require("mongoose");

const MONGO_CONNECT_TIMEOUT_MS = Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 15000);
const MONGO_SERVER_SELECTION_TIMEOUT_MS = Number(
  process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 15000
);

const maskMongoUri = (uri) =>
  String(uri || "").replace(
    /(mongodb(?:\+srv)?:\/\/)([^:/@]+)(?::([^@]*))?@/i,
    (_match, protocol) => `${protocol}***:***@`
  );

const validateMongoUri = (mongoUri) => {
  const sanitizedUri = String(mongoUri || "").trim();
  if (!sanitizedUri) {
    throw new Error("MONGODB_URI is not defined in environment variables");
  }

  if (!/^mongodb(?:\+srv)?:\/\//i.test(sanitizedUri)) {
    throw new Error("MONGODB_URI must start with mongodb:// or mongodb+srv://");
  }

  const credentialsMatch = sanitizedUri.match(/^mongodb(?:\+srv)?:\/\/([^@/]+)@/i);
  if (credentialsMatch) {
    const credentialsPart = credentialsMatch[1];
    if (/%(?![0-9A-Fa-f]{2})/.test(credentialsPart)) {
      throw new Error(
        "MONGODB_URI contains invalid percent-encoding. URL encode username/password."
      );
    }

    if (/[?#\s]/.test(credentialsPart)) {
      throw new Error(
        "MONGODB_URI credentials contain unsafe characters. URL encode username/password."
      );
    }
  }

  return sanitizedUri;
};

const connectDB = async () => {
  const mongoUri = validateMongoUri(process.env.MONGODB_URI);

  const connectOptions = {
    serverSelectionTimeoutMS: Number.isFinite(MONGO_SERVER_SELECTION_TIMEOUT_MS)
      ? MONGO_SERVER_SELECTION_TIMEOUT_MS
      : 15000,
    connectTimeoutMS: Number.isFinite(MONGO_CONNECT_TIMEOUT_MS)
      ? MONGO_CONNECT_TIMEOUT_MS
      : 15000,
    socketTimeoutMS: 45000,
  };

  try {
    await mongoose.connect(mongoUri, connectOptions);
    console.log("MongoDB connected");
  } catch (error) {
    const isSrvUri = /^mongodb\+srv:\/\//i.test(mongoUri);
    const errorMessage = String(error?.message || "");
    const isDnsRelated =
      /ENOTFOUND|EAI_AGAIN|querySrv|DNS/i.test(errorMessage) ||
      /ENOTFOUND|EAI_AGAIN/i.test(String(error?.code || ""));

    console.error("MongoDB connection error:", {
      name: error?.name || "Error",
      code: error?.code || "UNKNOWN",
      message: errorMessage || "Unknown MongoDB connection error",
      dnsRelated: isDnsRelated,
      uri: maskMongoUri(mongoUri),
    });

    if (isSrvUri && isDnsRelated) {
      console.error(
        "SRV DNS resolution failed. Verify DNS/network access and URL-encode MongoDB credentials."
      );
    }

    throw new Error("Failed to connect to MongoDB");
  }
};

module.exports = connectDB;
