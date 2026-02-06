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

  // password hashing
  const plainPassword = password || "password123";

  const newUser = await User.create({
    name,
    email,
    password: plainPassword, // will be hashed by the pre-save hook
    role: role || "viewer",
    phone,
  });

  await sendEmail({
    to: email,
    subject: "Welcome to Event Management System",
    text: `Hello ${name},\n\nYour account has been created successfully.\n\nYour login credentials are:\nEmail: ${email}\nphone: ${phone}\nPassword: ${plainPassword}\n\nPlease change your password after logging in for the first time.\n\nThank you!`,
  });

  const token = generateToken({ id: newUser._id, role: newUser.role });
  res.status(201).json({
    _id: newUser._id,
    name: newUser.name,
    email: newUser.email,
    phone: newUser.phone,
    password: newUser.password,
    role: newUser.role,
    status: "success",
    message: "User created successfully",
    token,
  });
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(plainPassword, salt);
  console.log(hashedPassword);
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+password");
  console.log(user);

  if (user.password !== password) {
    return res.status(400).json({
      status: "error",
      message: "Invalid credentials",
    });
  }
  //   if(!user || !user.comparePassword(password)){
  //   return res.status(400).json({
  //     status: "error",
  //     message: "Invalid credentials"
  //    });
  //   }
  const token = generateToken({ id: user._id, role: user.role });
  res.status(200).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    password: user.password,
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
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { name, email, password, role, phone },
    { new: true }
  );
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
