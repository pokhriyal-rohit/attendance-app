const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const parseTimeToMinutes = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const parts = value.split(":");
  if (parts.length < 2) {
    return null;
  }

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
};

const getCurrentDayAndTime = (date = new Date()) => ({
  dayOfWeek: DAY_NAMES[date.getDay()],
  currentTime: date.toTimeString().slice(0, 5),
});

const isTimeWithinRange = (time, startTime, endTime) => {
  const timeMinutes = parseTimeToMinutes(time);
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  if (
    !Number.isFinite(timeMinutes) ||
    !Number.isFinite(startMinutes) ||
    !Number.isFinite(endMinutes)
  ) {
    return false;
  }

  return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
};

const doTimeRangesOverlap = (firstStart, firstEnd, secondStart, secondEnd) => {
  const firstStartMinutes = parseTimeToMinutes(firstStart);
  const firstEndMinutes = parseTimeToMinutes(firstEnd);
  const secondStartMinutes = parseTimeToMinutes(secondStart);
  const secondEndMinutes = parseTimeToMinutes(secondEnd);

  if (
    !Number.isFinite(firstStartMinutes) ||
    !Number.isFinite(firstEndMinutes) ||
    !Number.isFinite(secondStartMinutes) ||
    !Number.isFinite(secondEndMinutes)
  ) {
    return false;
  }

  return firstStartMinutes < secondEndMinutes && firstEndMinutes > secondStartMinutes;
};

module.exports = {
  DAY_NAMES,
  parseTimeToMinutes,
  getCurrentDayAndTime,
  isTimeWithinRange,
  doTimeRangesOverlap,
};
