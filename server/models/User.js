const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["student", "teacher", "admin"],
      required: true,
    },
    section: {
      type: String,
      trim: true,
    },
    lastLoginIP: {
      type: String,
      trim: true,
    },
    lastLoginDevice: {
      type: String,
      trim: true,
    },
    resetToken: {
      type: String,
    },
    resetTokenExpiry: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
