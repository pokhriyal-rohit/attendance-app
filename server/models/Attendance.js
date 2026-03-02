const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
    },
    date: Date,
    insideTime: {
      type: Number,
      default: 0,
    },
    boundaryCrossings: {
      type: Number,
      default: 0,
    },
    lastLatitude: Number,
    lastLongitude: Number,
    lastLocationTimestamp: Date,
    previousInsideState: {
      type: Boolean,
      default: false,
    },
    toggleTimestamps: {
      type: [Date],
      default: [],
    },
    isSuspicious: {
      type: Boolean,
      default: false,
    },
    suspiciousScore: {
      type: Number,
      default: 0,
    },
    suspicionReasons: {
      type: [String],
      default: [],
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["Present", "Absent", "Flagged"],
    },
  },
  { timestamps: true }
);

attendanceSchema.index({ student: 1, room: 1, date: 1 });
attendanceSchema.index({ room: 1, date: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
