const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    floor: {
      type: Number,
    },
    polygonCoordinates: [
      {
        lat: Number,
        lng: Number,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Room", roomSchema);
