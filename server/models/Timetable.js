const mongoose = require("mongoose");

const timetableSchema = new mongoose.Schema(
  {
    section: String,
    subject: String,
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
    },
    dayOfWeek: String,
    startTime: String,
    endTime: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Timetable", timetableSchema);
