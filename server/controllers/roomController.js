const mongoose = require("mongoose");
const Room = require("../models/Room");
const Timetable = require("../models/Timetable");
const User = require("../models/User");
const { normalizePolygonCoordinates } = require("../utils/geo");
const { sanitizeString } = require("../utils/validation");
const { getCurrentDayAndTime, isTimeWithinRange } = require("../utils/time");

const buildRoomPayload = (body, requirePolygon) => {
  const payload = {};

  if (typeof body.name === "string") {
    payload.name = sanitizeString(body.name, 120);
  }

  if (body.floor !== undefined) {
    const floor = Number(body.floor);
    if (Number.isFinite(floor)) {
      payload.floor = floor;
    }
  }

  if (body.polygonCoordinates !== undefined || requirePolygon) {
    const normalizedPolygon = normalizePolygonCoordinates(body.polygonCoordinates);
    if (normalizedPolygon.length < 4) {
      return { error: "At least 3 valid polygon coordinates are required" };
    }
    payload.polygonCoordinates = normalizedPolygon;
  }

  if (!payload.name) {
    return { error: "Room name is required" };
  }

  return { payload };
};

const createRoom = async (req, res) => {
  try {
    const { payload, error } = buildRoomPayload(req.body, true);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const room = await Room.create(payload);
    return res.status(201).json(room);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to create room" });
  }
};

const getRooms = async (req, res) => {
  try {
    const rooms = await Room.find().sort({ name: 1, createdAt: -1 }).lean();
    return res.json(rooms);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch rooms" });
  }
};

const getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id).lean();
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }
    return res.json(room);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch room" });
  }
};

const updateRoom = async (req, res) => {
  try {
    const existingRoom = await Room.findById(req.params.id);
    if (!existingRoom) {
      return res.status(404).json({ message: "Room not found" });
    }

    const mergedBody = {
      name: req.body.name ?? existingRoom.name,
      floor: req.body.floor ?? existingRoom.floor,
      polygonCoordinates: req.body.polygonCoordinates ?? existingRoom.polygonCoordinates,
    };

    const { payload, error } = buildRoomPayload(mergedBody, true);
    if (error) {
      return res.status(400).json({ message: error });
    }

    Object.assign(existingRoom, payload);
    await existingRoom.save();
    return res.json(existingRoom);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update room" });
  }
};

const deleteRoom = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid room id" });
    }

    const room = await Room.findById(req.params.id).select("_id name").lean();
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    await Promise.all([
      Room.deleteOne({ _id: room._id }),
      Timetable.updateMany({ room: room._id }, { $unset: { room: 1 } }),
    ]);

    return res.json({ message: "Room deleted successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to delete room" });
  }
};

const getRoomStatus = async (_req, res) => {
  try {
    const [rooms, { dayOfWeek, currentTime }] = await Promise.all([
      Room.find({}).select("_id name").sort({ name: 1 }).lean(),
      Promise.resolve(getCurrentDayAndTime()),
    ]);

    const timetableEntries = await Timetable.find({
      dayOfWeek,
      room: { $ne: null },
    })
      .select("_id section room startTime endTime")
      .lean();

    const activeEntries = timetableEntries.filter((entry) =>
      isTimeWithinRange(currentTime, entry.startTime, entry.endTime)
    );

    const sections = Array.from(
      new Set(
        activeEntries
          .map((entry) => sanitizeString(entry.section, 50))
          .filter(Boolean)
      )
    );

    const teachers = await User.find({
      role: "teacher",
      section: { $in: sections },
    })
      .select("_id name section")
      .lean();

    const teacherBySection = new Map();
    for (const teacher of teachers) {
      const key = sanitizeString(teacher.section, 50);
      if (key && !teacherBySection.has(key)) {
        teacherBySection.set(key, teacher.name);
      }
    }

    const activeByRoom = new Map();
    for (const entry of activeEntries) {
      const roomId = String(entry.room);
      if (!activeByRoom.has(roomId)) {
        const section = sanitizeString(entry.section, 50);
        activeByRoom.set(roomId, {
          section,
          teacherName: teacherBySection.get(section) || "Unknown",
          startTime: entry.startTime || "",
          endTime: entry.endTime || "",
        });
      }
    }

    const statusRows = rooms.map((room) => {
      const activeRoom = activeByRoom.get(String(room._id));
      return {
        roomId: room._id,
        roomName: room.name,
        occupied: Boolean(activeRoom),
        section: activeRoom?.section || "",
        teacherName: activeRoom?.teacherName || "",
        startTime: activeRoom?.startTime || "",
        endTime: activeRoom?.endTime || "",
      };
    });

    return res.json(statusRows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch room status" });
  }
};

module.exports = {
  createRoom,
  getRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
  getRoomStatus,
};
