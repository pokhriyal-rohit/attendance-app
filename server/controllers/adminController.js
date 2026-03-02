const mongoose = require("mongoose");
const User = require("../models/User");
const Room = require("../models/Room");
const Attendance = require("../models/Attendance");
const AttendanceLog = require("../models/AttendanceLog");
const { sanitizeString, isValidRole } = require("../utils/validation");

const ATTENDANCE_STATUSES = ["Present", "Absent", "Flagged"];

const parseObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return null;
  }
  return new mongoose.Types.ObjectId(value);
};

const getUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .select("_id name email role section createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ users });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch users" });
  }
};

const deleteUser = async (req, res) => {
  try {
    const userId = parseObjectId(req.params.id);
    if (!userId) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (String(userId) === req.user.id) {
      return res.status(400).json({ message: "Admin cannot delete self" });
    }

    const user = await User.findById(userId).select("_id role").lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await User.deleteOne({ _id: userId });

    if (user.role === "student") {
      await Promise.all([
        Attendance.deleteMany({ student: userId }),
        AttendanceLog.deleteMany({ student: userId }),
      ]);
    }

    return res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to delete user" });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const userId = parseObjectId(req.params.id);
    if (!userId) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const role = sanitizeString(req.body.role, 20).toLowerCase();
    if (!isValidRole(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (String(userId) === req.user.id) {
      return res.status(400).json({ message: "Admin cannot change own role" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.role = role;
    if (role !== "student") {
      user.section = user.section || "";
    }

    await user.save();

    return res.json({
      message: "User role updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        section: user.section || "",
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to update user role" });
  }
};

const getRooms = async (req, res) => {
  try {
    const rooms = await Room.find({})
      .select("_id name floor polygonCoordinates createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const normalizedRooms = rooms.map((room) => ({
      id: room._id,
      name: room.name,
      floor: room.floor,
      polygonCoordinates: Array.isArray(room.polygonCoordinates)
        ? room.polygonCoordinates
        : [],
      polygonPointCount: Array.isArray(room.polygonCoordinates)
        ? room.polygonCoordinates.length
        : 0,
      createdAt: room.createdAt,
    }));

    return res.json({ rooms: normalizedRooms });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch rooms" });
  }
};

const getAttendanceOverview = async (req, res) => {
  try {
    const [summaryRows, flaggedStudents] = await Promise.all([
      Attendance.aggregate([
        {
          $match: {
            status: { $in: ATTENDANCE_STATUSES },
          },
        },
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
            present: {
              $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] },
            },
            absent: {
              $sum: { $cond: [{ $eq: ["$status", "Absent"] }, 1, 0] },
            },
            flagged: {
              $sum: { $cond: [{ $eq: ["$status", "Flagged"] }, 1, 0] },
            },
            suspicious: {
              $sum: { $cond: [{ $eq: ["$isSuspicious", true] }, 1, 0] },
            },
          },
        },
      ]),
      Attendance.aggregate([
        {
          $match: {
            student: { $ne: null },
            $or: [{ status: "Flagged" }, { isSuspicious: true }],
          },
        },
        { $sort: { lastUpdated: -1, date: -1, createdAt: -1 } },
        {
          $group: {
            _id: "$student",
            flaggedCount: { $sum: 1 },
            lastStatus: { $first: "$status" },
            isSuspicious: { $first: "$isSuspicious" },
            lastUpdated: { $first: "$lastUpdated" },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "studentDoc",
          },
        },
        { $unwind: "$studentDoc" },
        {
          $match: {
            "studentDoc.role": "student",
          },
        },
        {
          $project: {
            _id: 0,
            studentId: "$_id",
            name: "$studentDoc.name",
            email: "$studentDoc.email",
            section: { $ifNull: ["$studentDoc.section", ""] },
            flaggedCount: 1,
            lastStatus: { $ifNull: ["$lastStatus", "Flagged"] },
            isSuspicious: 1,
            lastUpdated: 1,
          },
        },
        { $sort: { flaggedCount: -1, name: 1 } },
      ]),
    ]);

    const summary = summaryRows[0] || {
      totalRecords: 0,
      present: 0,
      absent: 0,
      flagged: 0,
      suspicious: 0,
    };

    return res.json({
      summary,
      flaggedStudents,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch attendance overview" });
  }
};

module.exports = {
  getUsers,
  deleteUser,
  updateUserRole,
  getRooms,
  getAttendanceOverview,
};
