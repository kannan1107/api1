import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import connectDB from "./src/config/db.js";
import { errorHandler } from "./src/middleware/errorHandler.js";
import authRouter from "./src/routes/authRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import eventRoutes from "./src/routes/eventRoutes.js";
import bookingRoutes from "./src/routes/bookingRoutes.js";
import cors from "cors";
import paymentRouters from "./src/routes/paymentRoutes.js";
import Payment from "./src/model/Payment.js"; // Add Payment model import

dotenv.config();
const app = express();
app.use(cors());

// Create uploads directory FIRST
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Body parsers
app.use(express.json());
app.use(express.text({ type: "text/plain" }));
app.use(express.urlencoded({ extended: true }));

// Handle text/plain as JSON
app.use("/api", (req, res, next) => {
  const ct = req.headers["content-type"] || "";
  if (ct.toLowerCase().includes("text/plain")) {
    req.headers["content-type"] = "application/json";
  }
  next();
});

// Configure multer AFTER uploads exists
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

// Static files and upload middleware
app.use("/uploads", express.static("uploads"));
app.use("/api/events", upload.fields([{ name: "image" }, { name: "video" }]));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} at ${new Date().toLocaleString()}`);
  console.log("Content-Type:", req.headers["content-type"]);
  console.log("Body:", req.body);
  next();
});

// Remove manual payment route and use router instead
app.use("/api/auth", authRouter);
app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payment", paymentRouters); // preferred: singular path
app.use("/api/payments", paymentRouters); // optional: keep plural for backward compatibility
app.use("/api/payment/tickets", paymentRouters);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Connect to DB before starting server
(async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log("Server is running on port", PORT);
    });
  } catch (err) {
    console.error("Failed to connect to DB:", err);
    process.exit(1);
  }
})();
