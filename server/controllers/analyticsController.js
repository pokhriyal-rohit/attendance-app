const User = require("../models/User");
const Room = require("../models/Room");
const Attendance = require("../models/Attendance");
const { getRedisClient } = require("../utils/redisClient");

const STATUS_VALUES = ["Present", "Absent", "Flagged"];
const ANALYTICS_OVERVIEW_CACHE_KEY = "analytics:overview";
const ANALYTICS_OVERVIEW_CACHE_TTL_SECONDS = 60;

const getLast7DaysWindow = () => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const startDate = new Date(todayStart);
  startDate.setDate(startDate.getDate() - 6);

  const endDate = new Date(todayStart);
  endDate.setDate(endDate.getDate() + 1);

  return { startDate, endDate };
};

const formatDayKey = (date) => date.toISOString().slice(0, 10);

const buildLast7DaySeries = (dailyRows) => {
  const { startDate } = getLast7DaysWindow();
  const dailyMap = new Map(dailyRows.map((row) => [row.day, row]));
  const result = [];

  for (let i = 0; i < 7; i += 1) {
    const dayDate = new Date(startDate);
    dayDate.setDate(startDate.getDate() + i);
    const dayKey = formatDayKey(dayDate);
    const row = dailyMap.get(dayKey);

    result.push({
      day: dayKey,
      present: row?.present || 0,
      absent: row?.absent || 0,
      flagged: row?.flagged || 0,
      total: row?.total || 0,
      attendanceRate: row?.attendanceRate || 0,
    });
  }

  return result;
};

const getAnalyticsOverview = async (req, res) => {
  try {
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        const cachedPayload = await redisClient.get(ANALYTICS_OVERVIEW_CACHE_KEY);
        if (cachedPayload) {
          return res.json(JSON.parse(cachedPayload));
        }
      } catch (cacheReadError) {
        console.error("Analytics cache read error:", cacheReadError.message);
      }
    }

    const { startDate, endDate } = getLast7DaysWindow();

    const [
      roleCounts,
      roomCountRows,
      attendanceRatePerSection,
      dailyAttendanceRows,
      flaggedStudentRows,
      statusBreakdownRows,
    ] = await Promise.all([
      User.aggregate([
        {
          $group: {
            _id: null,
            totalStudents: {
              $sum: { $cond: [{ $eq: ["$role", "student"] }, 1, 0] },
            },
            totalTeachers: {
              $sum: { $cond: [{ $eq: ["$role", "teacher"] }, 1, 0] },
            },
          },
        },
      ]),
      Room.aggregate([{ $count: "totalRooms" }]),
      Attendance.aggregate([
        {
          $match: {
            status: { $in: STATUS_VALUES },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "student",
            foreignField: "_id",
            as: "studentDoc",
          },
        },
        { $unwind: "$studentDoc" },
        {
          $group: {
            _id: {
              $ifNull: ["$studentDoc.section", "Unassigned"],
            },
            total: { $sum: 1 },
            present: {
              $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] },
            },
            absent: {
              $sum: { $cond: [{ $eq: ["$status", "Absent"] }, 1, 0] },
            },
            flagged: {
              $sum: { $cond: [{ $eq: ["$status", "Flagged"] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            _id: 0,
            section: "$_id",
            total: 1,
            present: 1,
            absent: 1,
            flagged: 1,
            attendanceRate: {
              $cond: [
                { $eq: ["$total", 0] },
                0,
                {
                  $round: [{ $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 2],
                },
              ],
            },
          },
        },
        { $sort: { section: 1 } },
      ]),
      Attendance.aggregate([
        {
          $match: {
            date: { $gte: startDate, $lt: endDate },
            status: { $in: STATUS_VALUES },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$date" },
            },
            total: { $sum: 1 },
            present: {
              $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] },
            },
            absent: {
              $sum: { $cond: [{ $eq: ["$status", "Absent"] }, 1, 0] },
            },
            flagged: {
              $sum: { $cond: [{ $eq: ["$status", "Flagged"] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            _id: 0,
            day: "$_id",
            total: 1,
            present: 1,
            absent: 1,
            flagged: 1,
            attendanceRate: {
              $cond: [
                { $eq: ["$total", 0] },
                0,
                {
                  $round: [{ $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 2],
                },
              ],
            },
          },
        },
        { $sort: { day: 1 } },
      ]),
      Attendance.aggregate([
        {
          $match: {
            student: { $ne: null },
            $or: [{ status: "Flagged" }, { isSuspicious: true }],
          },
        },
        { $group: { _id: "$student" } },
        { $count: "flaggedStudentCount" },
      ]),
      Attendance.aggregate([
        {
          $match: {
            status: { $in: STATUS_VALUES },
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            status: "$_id",
            count: 1,
          },
        },
      ]),
    ]);

    const roleSummary = roleCounts[0] || {};
    const totalStudents = roleSummary.totalStudents || 0;
    const totalTeachers = roleSummary.totalTeachers || 0;
    const totalRooms = roomCountRows[0]?.totalRooms || 0;
    const flaggedStudentCount = flaggedStudentRows[0]?.flaggedStudentCount || 0;

    const statusBreakdownMap = new Map(statusBreakdownRows.map((row) => [row.status, row.count]));
    const statusBreakdown = STATUS_VALUES.map((status) => ({
      status,
      count: statusBreakdownMap.get(status) || 0,
    }));

    const responsePayload = {
      totalStudents,
      totalTeachers,
      totalRooms,
      flaggedStudentCount,
      attendanceRatePerSection,
      attendanceRatePerDay: buildLast7DaySeries(dailyAttendanceRows),
      statusBreakdown,
    };

    if (redisClient) {
      try {
        await redisClient.set(
          ANALYTICS_OVERVIEW_CACHE_KEY,
          JSON.stringify(responsePayload),
          "EX",
          ANALYTICS_OVERVIEW_CACHE_TTL_SECONDS
        );
      } catch (cacheWriteError) {
        console.error("Analytics cache write error:", cacheWriteError.message);
      }
    }

    return res.json(responsePayload);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to load analytics overview" });
  }
};

module.exports = { getAnalyticsOverview };
