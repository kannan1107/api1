import { Router } from "express";
import { protect } from "../middleware/authmiddleware.js";
import {
  getAllUsers,
  updateUserRole,
  deleteUser,
  createUser,
  updateUser,
} from "../controller/userController.js";
import authorizeRole from "../middleware/roleMiddleware.js";

const userRoutes = Router();

// Public route - no authentication required
userRoutes.post("/", createUser);

// Protected admin routes
userRoutes.get("/", protect, authorizeRole("admin"), getAllUsers);
userRoutes.put("/:id/role", protect, authorizeRole("admin"), updateUserRole);
userRoutes.delete("/:id", protect, authorizeRole("admin"), deleteUser);
userRoutes.put("/:id", protect, authorizeRole("admin"), updateUser);

export default userRoutes;
