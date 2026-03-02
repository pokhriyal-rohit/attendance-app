const express = require("express");
const {
  getTeacherSectionDashboard,
  shiftLecture,
} = require("../controllers/teacherController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/section/:section", protect, authorize("teacher"), getTeacherSectionDashboard);
router.post("/shift-lecture", protect, authorize("teacher"), shiftLecture);

module.exports = router;
