import User from "../model/User.js";
import sendEmail from "../utils/sendEmail.js";
import bcrypt from "bcryptjs";

export const createUser = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({
        status: "error",
        message: "Name and email are required",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: "error",
        message: "User with this email already exists",
      });
    }

    const plainPassword = password || "password123";
    // const salt = await bcrypt.genSalt(10);
    // const hashedPassword = await bcrypt.hash(plainPassword, salt);

    const newUser = await User.create({
      name,
      email,
      phone,
      password: plainPassword,
      role: role || "user",
    });

    console.log("Attempting to send email to:", email);
    console.log("EMAIL_USER:", process.env.EMAIL_USER);
    console.log("EMAIL_PASS exists:", !!process.env.EMAIL_PASS);

    try {
      const emailResult = await sendEmail({
        to: email,
        subject: "Welcome to Event Management System",
        text: `Hello ${name},\n\nYour account has been created successfully.\n\nYour login credentials are:\nEmail: ${email}\nphone: ${phone}\nPassword: ${plainPassword}\n\nPlease change your password after logging in for the first time.\n\nThank you!`,
      });
      console.log("✅ Email sent successfully:", emailResult.messageId);
    } catch (emailError) {
      console.error("❌ Email failed:", emailError.message);
      console.error("Full error:", emailError);
    }

    return res.status(201).json({
      status: "success",
      message: "User created successfully",
      data: newUser,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json({
      status: "success",
      message: "Users fetched successfully",
      users,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({
        status: "error",
        message: "Role is required",
      });
    }
    const user = await User.findByIdAndUpdate(id, { role }, { new: true });
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }
    return res.status(200).json({
      status: "success",
      message: "User role updated successfully",
      user,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }
    res.status(200).json({
      status: "success",
      message: "User fetched successfully",
      user,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      id,
      { name, email, password, role, phone },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }
    res.status(200).json({
      status: "success",
      message: "User updated successfully",
      user,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }
    res.status(200).json({
      status: "success",
      message: "User deleted successfully",
      user,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
