import User from "../model/User.js";
import generateToken from "../utils/generateToken.js";
import bcrypt from "bcryptjs";

export const register = async (req, res) => {
  const { name, email, password, role, phone } = req.body || {};

  if (!name || !email) {
    return res.status(400).json({
      status: "error",
      message: "Name and email are required",
    });
  }

  const user = await User.findOne({ email });
  if (user) {
    return res.status(400).json({
      status: "error",
      message: "User already exists",
    });
  }

  const validRoles = ["admin", "user", "viewer"];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({
      status: "error",
      message: "Role must be admin, user, or viewer",
    });
  }

  const plainPassword = password || "password123";
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(plainPassword, salt);

  const newUser = await User.create({
    name,
    email,
    password: hashedPassword,
    role: role || "viewer",
    phone,
  });

  const token = generateToken({ id: newUser._id, role: newUser.role });
  res.status(201).json({
    _id: newUser._id,
    name: newUser.name,
    email: newUser.email,
    phone: newUser.phone,
    role: newUser.role,
    status: "success",
    message: "User created successfully",
    token,
  });
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !(await user.comparePassword(password))) {
    return res.status(400).json({
      status: "error",
      message: "Invalid credentials",
    });
  }

  const token = generateToken({ id: user._id, role: user.role });
  res.status(200).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: "success",
    message: "User logged in successfully",
    token,
  });
};

export const getme = async (req, res) => {
  const user = await User.findById(req.user.id);
  res.status(200).json({
    status: "success",
    message: "User fetched successfully",
    data: user,
  });
};

export const logout = (req, res) => {
  res.status(200).json({
    status: "success",
    message: "User logged out successfully",
  });
};

export const update = async (req, res) => {
  const { name, email, password, role, phone } = req.body;

  const updateData = { name, email, role, phone };

  if (password) {
    const salt = await bcrypt.genSalt(10);
    updateData.password = await bcrypt.hash(password, salt);
  }

  const user = await User.findByIdAndUpdate(req.user.id, updateData, {
    new: true,
  });
  res.status(200).json({
    status: "success",
    message: "User updated successfully",
    data: user,
  });
};

export const event = (req, res) => {
  res.send("event");
};

export const eventDetails = (req, res) => {
  res.send("eventDetails");
};

export const eventRegister = (req, res) => {
  res.send("eventRegister");
};
