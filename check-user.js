import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String,
  phone: Number,
});

const User = mongoose.model("User", userSchema);

await mongoose.connect(process.env.MONGO_URI);

// List all users (emails only)
const users = await User.find({}, "name email role");
console.log("Users in DB:", users);

// Reset password for admin
const email = "kannan11071985@gmail.com";
const newPassword = "Admin@1234";
const hash = await bcrypt.hash(newPassword, 10);
await User.updateOne({ email }, { password: hash });
console.log("Password reset for", email, "→ new password:", newPassword);

await mongoose.disconnect();
