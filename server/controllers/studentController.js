const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");

const MINIMUM_REQUIRED_PERCENTAGE = 75;
const MINIMUM_REQUIRED_RATIO = MINIMUM_REQUIRED_PERCENTAGE / 100;

const calculateClassesNeeded = (present, totalClasses) => {
  if (totalClasses <= 0) {
    return 0;
  }

  if (present / totalClasses >= MINIMUM_REQUIRED_RATIO) {
    return 0;
  }

  const required =
    (MINIMUM_REQUIRED_RATIO * totalClasses - present) / (1 - MINIMUM_REQUIRED_RATIO);
  return Math.max(0, Math.ceil(required));
};

const getStudentAttendanceSummary = async (req, res) => {
  try {
    const studentId = req.user?.id;
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: "Invalid student id" });
    }

    const studentObjectId = new mongoose.Types.ObjectId(studentId);
    const studentSection = req.user?.section || "";

    const pipelineResult = await Attendance.aggregate([
      {
        $match: {
          student: studentObjectId,
        },
      },
      {
        $lookup: {
          from: "rooms",
          localField: "room",
          foreignField: "_id",
          as: "roomDoc",
        },
      },
      {
        $unwind: {
          path: "$roomDoc",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          attendanceDay: {
            $arrayElemAt: [
              [
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
              ],
              { $subtract: [{ $dayOfWeek: "$date" }, 1] },
            ],
          },
        },
      },
      {
        $lookup: {
          from: "timetables",
          let: {
            roomId: "$room",
            attendanceDay: "$attendanceDay",
            sectionValue: studentSection,
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$room", "$$roomId"] },
                    {
                      $or: [
                        { $eq: ["$$sectionValue", ""] },
                        { $eq: ["$section", "$$sectionValue"] },
                      ],
                    },
                  ],
                },
              },
            },
            {
              $addFields: {
                dayMatch: { $eq: ["$dayOfWeek", "$$attendanceDay"] },
              },
            },
            {
              $sort: {
                dayMatch: -1,
                createdAt: 1,
              },
            },
            {
              $limit: 1,
            },
            {
              $project: {
                _id: 0,
                subject: 1,
              },
            },
          ],
          as: "timetableDoc",
        },
      },
      {
        $addFields: {
          subject: {
            $ifNull: [{ $arrayElemAt: ["$timetableDoc.subject", 0] }, "Unknown Subject"],
          },
        },
      },
      {
        $facet: {
          subjects: [
            {
              $group: {
                _id: "$subject",
                totalClasses: { $sum: 1 },
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
                subject: "$_id",
                totalClasses: 1,
                present: 1,
                absent: 1,
                flagged: 1,
                percentage: {
                  $cond: [
                    { $eq: ["$totalClasses", 0] },
                    0,
                    {
                      $round: [
                        {
                          $multiply: [{ $divide: ["$present", "$totalClasses"] }, 100],
                        },
                        2,
                      ],
                    },
                  ],
                },
                minimumRequired: { $literal: MINIMUM_REQUIRED_PERCENTAGE },
                shortage: {
                  $toInt: {
                    $max: [
                      0,
                      {
                        $ceil: {
                          $divide: [
                            {
                              $max: [
                                0,
                                {
                                  $subtract: [
                                    {
                                      $multiply: [
                                        MINIMUM_REQUIRED_RATIO,
                                        "$totalClasses",
                                      ],
                                    },
                                    "$present",
                                  ],
                                },
                              ],
                            },
                            1 - MINIMUM_REQUIRED_RATIO,
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
            {
              $sort: { subject: 1 },
            },
          ],
          overall: [
            {
              $group: {
                _id: null,
                totalClasses: { $sum: 1 },
                present: {
                  $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] },
                },
              },
            },
            {
              $project: {
                _id: 0,
                totalClasses: 1,
                present: 1,
              },
            },
          ],
        },
      },
    ]);

    const groupedSubjects = pipelineResult[0]?.subjects || [];
    const overall = pipelineResult[0]?.overall?.[0] || { totalClasses: 0, present: 0 };
    const overallPercentage =
      overall.totalClasses > 0
        ? Number(((overall.present / overall.totalClasses) * 100).toFixed(2))
        : 0;
    const overallShortage = calculateClassesNeeded(overall.present, overall.totalClasses);

    return res.json({
      subjects: groupedSubjects,
      overallPercentage,
      minimumRequired: MINIMUM_REQUIRED_PERCENTAGE,
      classesNeededToReachMinimum: overallShortage,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to load student attendance summary" });
  }
};

module.exports = { getStudentAttendanceSummary };
