import { Router } from "express";
import {
  event,
  eventDetails,
  eventRegister,
  getme,
  login,
  register,
} from "../controller/authController.js";
import { getAllUsers } from "../controller/userController.js";
import { protect } from "../middleware/authmiddleware.js";
import {
  createPayment,
  getUserPayments,
} from "../controller/paymentController.js";

const authRouter = Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.get("/me", protect, getme);
authRouter.get("/event", event);
authRouter.get("/event/:id", protect, event);
authRouter.post("/eventDatals", protect, eventDetails);
authRouter.post("/eventRegister", eventRegister);
authRouter.get("/users", getAllUsers);
authRouter.put("/users/:id", getAllUsers);
authRouter.post("/payment", createPayment);
authRouter.get("/payment", getUserPayments);

export default authRouter;
