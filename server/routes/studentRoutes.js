const express = require("express");
const { getStudentAttendanceSummary } = require("../controllers/studentController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/attendance-summary", protect, authorize("student"), getStudentAttendanceSummary);

module.exports = router;
