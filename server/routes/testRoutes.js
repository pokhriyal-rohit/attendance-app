const express = require("express");
const router = express.Router();
const axios = require("axios");
const { protect, authorize } = require("../middleware/authMiddleware");

router.get("/attendance-test", protect, authorize("student"), async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const response = await axios.post(
      "http://localhost:5000/api/attendance/track",
      {
        studentId: req.user.id,
        latitude: 28.6139,
        longitude: 77.2090,
      },
      {
        headers: {
          Authorization: authHeader,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({
      error: error.response?.data || error.message,
    });
  }
});

module.exports = router;
