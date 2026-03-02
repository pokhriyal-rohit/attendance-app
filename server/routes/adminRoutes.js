const express = require("express");
const {
  getUsers,
  deleteUser,
  updateUserRole,
  getRooms,
  getAttendanceOverview,
} = require("../controllers/adminController");
const {
  createRoom,
  updateRoom,
  deleteRoom: removeRoom,
} = require("../controllers/roomController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, authorize("admin"));

router.get("/users", getUsers);
router.delete("/users/:id", deleteUser);
router.put("/users/:id/role", updateUserRole);

router.get("/rooms", getRooms);
router.post("/rooms", createRoom);
router.put("/rooms/:id", updateRoom);
router.delete("/rooms/:id", removeRoom);
router.get("/attendance", getAttendanceOverview);

module.exports = router;
