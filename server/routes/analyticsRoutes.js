const express = require("express");
const { getAnalyticsOverview } = require("../controllers/analyticsController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/overview", protect, authorize("admin", "teacher"), getAnalyticsOverview);

module.exports = router;
