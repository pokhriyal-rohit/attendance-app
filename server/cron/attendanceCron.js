const cron = require("node-cron");
const Attendance = require("../models/Attendance");
const Timetable = require("../models/Timetable");

const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const toMinutes = (timeValue) => {
  if (typeof timeValue !== "string") {
    return null;
  }

  const [hours, minutes] = timeValue.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
};

const startAttendanceCron = () => {
  cron.schedule("*/5 * * * *", async () => {
    try {
      const now = new Date();
      const currentDayOfWeek = dayNames[now.getDay()];
      const currentTime = now.toTimeString().slice(0, 5);

      const endedClasses = await Timetable.find({
        dayOfWeek: currentDayOfWeek,
        endTime: { $lt: currentTime },
      }).select("room startTime endTime");

      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      for (const classEntry of endedClasses) {
        const startMinutes = toMinutes(classEntry.startTime);
        const endMinutes = toMinutes(classEntry.endTime);
        const classDuration = Math.max(0, (endMinutes || 0) - (startMinutes || 0));
        const requiredInsideTime = classDuration * 0.75;

        const attendanceRecords = await Attendance.find({
          room: classEntry.room,
          date: { $gte: startOfDay, $lt: endOfDay },
        });

        for (const record of attendanceRecords) {
          if (record.isSuspicious || record.boundaryCrossings > 10) {
            record.status = "Flagged";
          } else if (record.insideTime >= requiredInsideTime) {
            record.status = "Present";
          } else {
            record.status = "Absent";
          }

          await record.save();
        }
      }
    } catch (error) {
      console.error("Attendance cron error:", error.message);
    }
  });
};

module.exports = { startAttendanceCron };
