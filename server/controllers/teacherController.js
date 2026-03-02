const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const Room = require("../models/Room");
const Timetable = require("../models/Timetable");
const { getActiveClass } = require("./timetableController");
const { sanitizeString } = require("../utils/validation");
const { getCurrentDayAndTime, doTimeRangesOverlap } = require("../utils/time");

const getTodayRange = () => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  return { startOfDay, endOfDay };
};

const getTeacherSectionDashboard = async (req, res) => {
  try {
    const section = sanitizeString(req.params.section, 50);
    if (!section) {
      return res.status(400).json({ message: "Section is required" });
    }

    const students = await User.find({ section, role: "student" })
      .select("_id name section")
      .lean();

    const activeClass = await getActiveClass(section);
    const room = activeClass?.room || null;

    if (!room) {
      const attendanceRecords = students.map((student) => ({
        studentId: student._id,
        name: student.name,
        section: student.section,
        insideNow: false,
        insideTime: 0,
        boundaryCrossings: 0,
        status: "Absent",
        isSuspicious: false,
      }));

      return res.json({
        activeClass: null,
        room: null,
        attendanceRecords,
        summary: {
          totalStudents: students.length,
          present: 0,
          absent: students.length,
          flagged: 0,
          insideNow: 0,
        },
      });
    }

    const { startOfDay, endOfDay } = getTodayRange();
    const records = await Attendance.find({
      room: room._id,
      student: { $in: students.map((student) => student._id) },
      date: { $gte: startOfDay, $lt: endOfDay },
    }).lean();

    const recordsByStudentId = new Map(
      records.map((record) => [String(record.student), record])
    );

    const attendanceRecords = students.map((student) => {
      const record = recordsByStudentId.get(String(student._id));
      const isSuspicious = Boolean(record?.isSuspicious);
      const status = record?.status || (isSuspicious ? "Flagged" : record ? "Pending" : "Absent");
      return {
        studentId: student._id,
        name: student.name,
        section: student.section,
        insideNow: Boolean(record?.previousInsideState),
        insideTime: record?.insideTime || 0,
        boundaryCrossings: record?.boundaryCrossings || 0,
        status,
        isSuspicious,
        lastUpdated: record?.lastUpdated || null,
      };
    });

    const summary = attendanceRecords.reduce(
      (acc, record) => {
        if (record.status === "Present") {
          acc.present += 1;
        }

        if (record.status === "Flagged" || record.isSuspicious) {
          acc.flagged += 1;
        }

        if (record.insideNow) {
          acc.insideNow += 1;
        }

        return acc;
      },
      {
        totalStudents: students.length,
        present: 0,
        absent: students.length,
        flagged: 0,
        insideNow: 0,
      }
    );
    summary.absent = Math.max(0, summary.totalStudents - summary.present - summary.flagged);

    return res.json({
      activeClass: {
        id: activeClass._id,
        subject: activeClass.subject,
        section: activeClass.section,
        dayOfWeek: activeClass.dayOfWeek,
        startTime: activeClass.startTime,
        endTime: activeClass.endTime,
      },
      room: {
        id: room._id,
        name: room.name,
        floor: room.floor,
        polygonCoordinates: room.polygonCoordinates || [],
      },
      attendanceRecords,
      summary,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to load teacher dashboard" });
  }
};

const shiftLecture = async (req, res) => {
  try {
    const teacherSection = sanitizeString(req.user?.section, 50);
    const currentRoomId = sanitizeString(req.body?.currentRoomId, 64);
    const targetRoomId = sanitizeString(req.body?.targetRoomId, 64);

    if (!teacherSection) {
      return res.status(400).json({ message: "Teacher has no section assigned" });
    }

    if (!mongoose.Types.ObjectId.isValid(targetRoomId)) {
      return res.status(400).json({ message: "Invalid target room id" });
    }

    if (currentRoomId && !mongoose.Types.ObjectId.isValid(currentRoomId)) {
      return res.status(400).json({ message: "Invalid current room id" });
    }

    if (currentRoomId && String(currentRoomId) === String(targetRoomId)) {
      return res.status(400).json({ message: "Current room and target room must be different" });
    }

    const [targetRoom, activeClass] = await Promise.all([
      Room.findById(targetRoomId).select("_id name floor").lean(),
      getActiveClass(teacherSection),
    ]);

    if (!targetRoom) {
      return res.status(404).json({ message: "Target room not found" });
    }

    if (!activeClass || !activeClass.room) {
      return res.status(404).json({ message: "No active class to shift right now" });
    }

    const activeRoomId = String(activeClass.room?._id || activeClass.room);
    if (currentRoomId && activeRoomId !== String(currentRoomId)) {
      return res.status(400).json({ message: "Selected current room does not match active class room" });
    }

    const { dayOfWeek } = getCurrentDayAndTime();

    const targetRoomTimetables = await Timetable.find({
      dayOfWeek,
      room: targetRoom._id,
      _id: { $ne: activeClass._id },
    })
      .select("_id section startTime endTime")
      .lean();

    const conflictClass = targetRoomTimetables.find((entry) =>
      doTimeRangesOverlap(
        activeClass.startTime,
        activeClass.endTime,
        entry.startTime,
        entry.endTime
      )
    );

    if (conflictClass) {
      const section = sanitizeString(conflictClass.section, 50);
      const conflictTeacher = await User.findOne({
        role: "teacher",
        section,
      })
        .select("_id name")
        .lean();

      return res.status(409).json({
        conflict: true,
        section,
        teacherName: conflictTeacher?.name || "Unknown",
        startTime: conflictClass.startTime || "",
        endTime: conflictClass.endTime || "",
      });
    }

    const updatedClass = await Timetable.findByIdAndUpdate(
      activeClass._id,
      { room: targetRoom._id },
      { new: true }
    )
      .populate("room", "name floor polygonCoordinates")
      .lean();

    if (!updatedClass) {
      return res.status(404).json({ message: "Active class was not found for update" });
    }

    return res.json({
      conflict: false,
      message: "Lecture shifted successfully",
      activeClass: {
        id: updatedClass._id,
        subject: updatedClass.subject,
        section: updatedClass.section,
        dayOfWeek: updatedClass.dayOfWeek,
        startTime: updatedClass.startTime,
        endTime: updatedClass.endTime,
      },
      room: updatedClass.room
        ? {
            id: updatedClass.room._id,
            name: updatedClass.room.name,
            floor: updatedClass.room.floor,
          }
        : null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to shift lecture" });
  }
};

module.exports = { getTeacherSectionDashboard, shiftLecture };
