const mongoose = require("mongoose");

const attendanceLogSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    inside: {
      type: Boolean,
      required: true,
    },
    suspicious: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

attendanceLogSchema.index({ student: 1, room: 1, timestamp: -1 });

module.exports = mongoose.model("AttendanceLog", attendanceLogSchema);
