const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  trackAttendance,
  getLiveAttendanceByRoom,
  exportAttendanceReport,
} = require("../controllers/attendanceController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();
const attendanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attendance updates. Please retry shortly." },
});

router.post(
  "/track",
  protect,
  authorize("student", "teacher"),
  attendanceLimiter,
  trackAttendance
);
router.get("/live/:roomId", protect, authorize("teacher"), getLiveAttendanceByRoom);
router.post("/export", protect, authorize("teacher"), exportAttendanceReport);

module.exports = router;
