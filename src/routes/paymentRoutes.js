import express from "express";
import {
  createPayment,
  getUserPayments,
  getPaymentById,
} from "../controller/paymentController.js";
import { protect } from "../middleware/authmiddleware.js";

const paymentRouters = express.Router();

console.log("Payment routes file loaded");

// Test route (no auth)
paymentRouters.post("/payments", (req, res) => {
  console.log("Payment test route hit");
  res.json({ message: "Payment test working", body: req.body });
});

// All routes require authentication
paymentRouters.use(protect);

// POST /api/payment - Create payment
paymentRouters.post("/", createPayment);

// GET /api/payment - Get user payments
paymentRouters.get("/tickets", getUserPayments);

// GET /api/payment/:id - Get payment by ID
paymentRouters.get("/:id", getPaymentById);

export default paymentRouters;
