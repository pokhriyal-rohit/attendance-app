const { Server } = require("socket.io");
const { verifyToken } = require("./jwt");

let ioInstance = null;

const initSocket = (httpServer) => {
  const isProduction = process.env.NODE_ENV === "production";
  const socketCorsOrigin = isProduction
    ? process.env.FRONTEND_URL
    : ["http://localhost:5173", "http://localhost:3000"];

  ioInstance = new Server(httpServer, {
    cors: {
      origin: socketCorsOrigin,
      credentials: true,
    },
  });

  ioInstance.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) {
        return next(new Error("Unauthorized socket"));
      }

      const decoded = verifyToken(token);
      socket.user = decoded;
      return next();
    } catch (error) {
      return next(new Error("Unauthorized socket"));
    }
  });

  ioInstance.on("connection", (socket) => {
    socket.on("joinRoom", (roomId) => {
      if (socket.user?.role !== "teacher") {
        return;
      }
      if (typeof roomId === "string" && roomId.trim()) {
        socket.join(roomId);
      }
    });

    socket.on("leaveRoom", (roomId) => {
      if (typeof roomId === "string" && roomId.trim()) {
        socket.leave(roomId);
      }
    });
  });

  return ioInstance;
};

const getIO = () => {
  if (!ioInstance) {
    throw new Error("Socket.io is not initialized");
  }
  return ioInstance;
};

module.exports = { initSocket, getIO };