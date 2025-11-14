import { Router } from "express";
import { protect } from "../middleware/authmiddleware.js";
import {
  getAllEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  processEventPayment,
} from "../controller/eventController.js";
import authorizeRole from "../middleware/roleMiddleware.js";

const eventRoutes = Router();

// get/api/event all

eventRoutes.get("/", getAllEvents);

// post /api/event/ create event
eventRoutes.post(
  "/",
  protect,
  authorizeRole("admin", "user", "viewer"),
  createEvent
);

// put /api/event/:id
eventRoutes.put("/:id", protect, authorizeRole("admin", "user"), updateEvent);

// delete /api/event/:id
eventRoutes.delete("/:id", protect, authorizeRole("admin"), deleteEvent);

// POST /api/events/:id/payment - Process payment
eventRoutes.post("/:id/payment", protect, processEventPayment);

export default eventRoutes;
