const express = require("express");
const {
  createRoom,
  getRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
  getRoomStatus,
} = require("../controllers/roomController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
  "/status",
  protect,
  authorize("student", "teacher", "admin"),
  getRoomStatus
);
router.get("/", protect, authorize("student", "teacher", "admin"), getRooms);
router.get("/:id", protect, authorize("student", "teacher", "admin"), getRoomById);
router.post("/", protect, authorize("admin"), createRoom);
router.put("/:id", protect, authorize("admin"), updateRoom);
router.delete("/:id", protect, authorize("admin"), deleteRoom);

module.exports = router;
