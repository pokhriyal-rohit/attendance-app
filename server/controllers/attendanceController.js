const mongoose = require("mongoose");
const User = require("../models/User");
const Room = require("../models/Room");
const Attendance = require("../models/Attendance");
const AttendanceLog = require("../models/AttendanceLog");
const { getActiveClass } = require("./timetableController");
const { checkIfInsidePolygon, calculateDistanceMeters } = require("../utils/geo");
const { parseCoordinate } = require("../utils/validation");
const { getIO } = require("../utils/socket");
const { generateAttendanceWorkbook } = require("../utils/excelGenerator");
const { sendAttendanceReportEmail } = require("../utils/emailService");

const SPEED_LIMIT_KMH = 200;
const TELEPORT_DISTANCE_METERS = 2000;
const TELEPORT_WINDOW_SECONDS = 10;
const TOGGLE_LIMIT_PER_MINUTE = 5;
const MAX_INSIDE_INCREMENT_MINUTES = 0.25;

const getTodayRange = () => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  return { startOfDay, endOfDay };
};

const getDateRangeFromInput = (dateInput) => {
  let parsedDate;
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split("-").map(Number);
    parsedDate = new Date(year, month - 1, day);
  } else {
    parsedDate = new Date(dateInput);
  }

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const startOfDay = new Date(parsedDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  return { startOfDay, endOfDay };
};

const evaluateSuspicion = ({ attendance, lat, lng, inside, now }) => {
  const reasons = [];
  const previousTimestamp = attendance.lastLocationTimestamp
    ? new Date(attendance.lastLocationTimestamp)
    : null;
  const hasPreviousLocation =
    Number.isFinite(attendance.lastLatitude) &&
    Number.isFinite(attendance.lastLongitude) &&
    previousTimestamp &&
    !Number.isNaN(previousTimestamp.getTime());

  if (hasPreviousLocation) {
    const distanceMeters = calculateDistanceMeters(
      attendance.lastLatitude,
      attendance.lastLongitude,
      lat,
      lng
    );
    const elapsedSeconds = (now.getTime() - previousTimestamp.getTime()) / 1000;

    if (elapsedSeconds > 0) {
      const speedKmh = (distanceMeters / 1000) / (elapsedSeconds / 3600);
      if (speedKmh > SPEED_LIMIT_KMH) {
        reasons.push("speed_check_failed");
      }
    }

    if (elapsedSeconds > 0 && elapsedSeconds <= TELEPORT_WINDOW_SECONDS && distanceMeters > TELEPORT_DISTANCE_METERS) {
      reasons.push("teleport_check_failed");
    }
  }

  const nextToggleTimestamps = Array.isArray(attendance.toggleTimestamps)
    ? attendance.toggleTimestamps.map((ts) => new Date(ts))
    : [];

  const previousInsideState = Boolean(attendance.previousInsideState);
  const hasToggled = previousInsideState !== inside;
  if (hasToggled) {
    nextToggleTimestamps.push(now);
  }

  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const recentToggles = nextToggleTimestamps.filter(
    (ts) => ts instanceof Date && !Number.isNaN(ts.getTime()) && ts >= oneMinuteAgo
  );

  if (recentToggles.length > TOGGLE_LIMIT_PER_MINUTE) {
    reasons.push("rapid_boundary_toggle");
  }

  return {
    reasons,
    recentToggles,
    previousInsideState,
  };
};

const trackAttendance = async (req, res) => {
  try {
    const { studentId, latitude, longitude } = req.body || {};
    if (process.env.NODE_ENV !== "production") {
      console.log("trackAttendance request received");
    }

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: "Invalid studentId" });
    }

    const lat = parseCoordinate(latitude, -90, 90);
    const lng = parseCoordinate(longitude, -180, 180);
    if (lat === null || lng === null) {
      return res.status(400).json({ message: "Invalid latitude or longitude" });
    }

    if (req.user?.role === "student" && req.user.id !== studentId) {
      return res.status(403).json({ message: "Students can only track their own attendance" });
    }

    const student = await User.findById(studentId)
      .select("_id name section role")
      .lean();
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    if (student.role !== "student") {
      return res.status(400).json({ message: "Attendance tracking is only for student role" });
    }

    if (!student.section) {
      return res.status(400).json({ message: "Student has no section assigned" });
    }

    const activeClass = await getActiveClass(student.section);
    if (!activeClass || !activeClass.room) {
      return res.json({ message: "No active class" });
    }

    const room = activeClass.room;

    let inside = false;
    try {
      inside = checkIfInsidePolygon(lat, lng, room.polygonCoordinates || []);
    } catch (err) {
      console.error("Polygon error:", err);
      return res.status(500).json({ message: "Polygon calculation failed" });
    }

    const { startOfDay, endOfDay } = getTodayRange();
    const now = new Date();

    let attendance = await Attendance.findOne({
      student: student._id,
      room: room._id,
      date: { $gte: startOfDay, $lt: endOfDay },
    });

    if (!attendance) {
      attendance = new Attendance({
        student: student._id,
        room: room._id,
        date: startOfDay,
        previousInsideState: inside,
        lastUpdated: now,
        lastLatitude: lat,
        lastLongitude: lng,
        lastLocationTimestamp: now,
      });

      if (inside) {
        attendance.insideTime += MAX_INSIDE_INCREMENT_MINUTES;
      }
    } else {
      const { reasons, recentToggles, previousInsideState } = evaluateSuspicion({
        attendance,
        lat,
        lng,
        inside,
        now,
      });

      const elapsedMinutes = attendance.lastUpdated
        ? (now.getTime() - new Date(attendance.lastUpdated).getTime()) / 60000
        : MAX_INSIDE_INCREMENT_MINUTES;
      const boundedIncrement = Math.max(
        0,
        Math.min(elapsedMinutes, MAX_INSIDE_INCREMENT_MINUTES)
      );

      if (inside && boundedIncrement > 0) {
        attendance.insideTime += boundedIncrement;
      }

      if (previousInsideState && !inside) {
        attendance.boundaryCrossings += 1;
      }

      attendance.previousInsideState = inside;
      attendance.lastUpdated = now;
      attendance.lastLatitude = lat;
      attendance.lastLongitude = lng;
      attendance.lastLocationTimestamp = now;
      attendance.toggleTimestamps = recentToggles;

      if (reasons.length > 0) {
        attendance.isSuspicious = true;
        attendance.status = "Flagged";
        attendance.suspiciousScore = (attendance.suspiciousScore || 0) + reasons.length;
        const reasonSet = new Set([...(attendance.suspicionReasons || []), ...reasons]);
        attendance.suspicionReasons = Array.from(reasonSet);
      }
    }

    if (attendance.isSuspicious) {
      attendance.status = "Flagged";
    }

    await attendance.save();

    await AttendanceLog.create({
      student: student._id,
      room: room._id,
      timestamp: now,
      latitude: lat,
      longitude: lng,
      inside,
      suspicious: Boolean(attendance.isSuspicious),
    });

    const updatedAttendance = {
      inside,
      insideTime: attendance.insideTime,
      boundaryCrossings: attendance.boundaryCrossings,
      status: attendance.status || "Pending",
      isSuspicious: Boolean(attendance.isSuspicious),
      suspiciousScore: attendance.suspiciousScore || 0,
      suspicionReasons: attendance.suspicionReasons || [],
      lastUpdated: attendance.lastUpdated,
    };

    const updatedData = {
      roomId: String(room._id),
      student: {
        id: String(student._id),
        name: student.name,
        section: student.section,
      },
      attendance: updatedAttendance,
    };

    const websocketUpdatePayload = {
      student: updatedData.student,
      room: {
        id: String(room._id),
        name: room.name,
      },
      inside,
      timestamp: now.toISOString(),
      attendance: updatedAttendance,
      roomId: String(room._id),
    };

    try {
      getIO().to(String(room._id)).emit("attendance:update", websocketUpdatePayload);
      getIO().to(String(room._id)).emit("attendanceUpdate", updatedData);
    } catch (socketError) {
      console.error("Socket emit error:", socketError.message);
    }

    return res.json({
      inside,
      message: inside ? "Inside classroom" : "Outside classroom",
      room: {
        id: room._id,
        name: room.name,
        polygonCoordinates: room.polygonCoordinates || [],
      },
      attendance: updatedData.attendance,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to track attendance" });
  }
};

const getLiveAttendanceByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ message: "Invalid roomId" });
    }

    const room = await Room.findById(roomId).select("_id name floor").lean();
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    const { startOfDay, endOfDay } = getTodayRange();
    const records = await Attendance.find({
      room: roomId,
      date: { $gte: startOfDay, $lt: endOfDay },
    }).lean();

    const studentIds = records.map((record) => record.student).filter(Boolean);
    const students = await User.find({ _id: { $in: studentIds } })
      .select("_id name section")
      .lean();
    const studentsById = new Map(students.map((student) => [String(student._id), student]));

    const mappedStudents = records.map((record) => {
      const student = studentsById.get(String(record.student));
      return {
        studentId: record.student,
        name: student?.name || "Unknown",
        section: student?.section || "",
        inside: Boolean(record.previousInsideState),
        insideTime: record.insideTime || 0,
        boundaryCrossings: record.boundaryCrossings || 0,
        status: record.status || "Pending",
        isSuspicious: Boolean(record.isSuspicious),
        suspiciousScore: record.suspiciousScore || 0,
        lastUpdated: record.lastUpdated || null,
      };
    });

    const insideStudents = mappedStudents.filter((student) => student.inside);

    return res.json({
      room: {
        id: room._id,
        name: room.name,
        floor: room.floor,
      },
      insideNow: insideStudents.length,
      insideStudents,
      students: mappedStudents,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch live attendance" });
  }
};

const exportAttendanceReport = async (req, res) => {
  try {
    const { roomId, date } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ message: "Invalid roomId" });
    }

    if (!date) {
      return res.status(400).json({ message: "date is required" });
    }

    const dateRange = getDateRangeFromInput(date);
    if (!dateRange) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    const room = await Room.findById(roomId).select("_id name").lean();
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    const records = await Attendance.find({
      room: roomId,
      date: { $gte: dateRange.startOfDay, $lt: dateRange.endOfDay },
    })
      .populate({
        path: "student",
        select: "name email section",
      })
      .sort({ createdAt: 1 })
      .lean();

    const workbookBuffer = await generateAttendanceWorkbook({
      roomName: room.name,
      reportDate: dateRange.startOfDay,
      records,
    });

    await sendAttendanceReportEmail({
      to: req.user.email,
      subject: `Attendance Report - ${room.name}`,
      text: `Attached attendance report for room ${room.name} on ${dateRange.startOfDay.toISOString().slice(0, 10)}.`,
      attachmentBuffer: workbookBuffer,
      fileName: "attendance.xlsx",
    });

    return res.json({
      message: "Attendance report emailed successfully",
      emailedTo: req.user.email,
      room: { id: room._id, name: room.name },
      date: dateRange.startOfDay.toISOString().slice(0, 10),
      recordCount: records.length,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to export attendance report" });
  }
};

module.exports = { trackAttendance, getLiveAttendanceByRoom, exportAttendanceReport };
