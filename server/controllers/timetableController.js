const { sanitizeString } = require("../utils/validation");
const Timetable = require("../models/Timetable");
const { getCurrentDayAndTime, isTimeWithinRange } = require("../utils/time");

const getActiveClass = async (section) => {
  const cleanSection = sanitizeString(section, 50);
  if (!cleanSection) {
    return null;
  }

  const { dayOfWeek, currentTime } = getCurrentDayAndTime();
  const dayTimetable = await Timetable.find({
    section: cleanSection,
    dayOfWeek,
  })
    .populate("room", "name floor polygonCoordinates")
    .lean();

  const activeClass = dayTimetable.find((entry) =>
    isTimeWithinRange(currentTime, entry.startTime, entry.endTime)
  );

  return activeClass || null;
};

module.exports = { getActiveClass };
