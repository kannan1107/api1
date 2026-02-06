import sendEmail from "../utils/sendEmail.js";
import Event from "../model/Event.js";
import Payment from "../model/Payment.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryUpload.js";

import fs from "fs";

// get /api/event all
export const getAllEvents = async (req, res) => {
  try {
    const events = await Event.find();
    res.status(200).json({
      status: "success",
      results: events.length,
      data: events,
      message: "Events fetched successfully",
    });
  } catch (error) {
    console.error("GET events error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// post /api/event/ create event
export const createEvent = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        status: "error",
        message: "Authentication failed: User information is missing.",
      });
    }

    // 1. Destructure all fields sent from Frontend
    const {
      title,
      description,
      date,
      location,
      category,
      viptickets, // Price
      regulartickets, // Price
      totalSeats, // Total Count
      vipSeats, // VIP Count (Added this)
      regularSeats, // Regular Count (Added this)
      organizer,
    } = req.body;

    console.log("Creating event:", { title, vipSeats, regularSeats });
    console.log("Ticket prices:", {
      viptickets,
      regulartickets,
      vipSeatsValue: vipSeats,
      regularSeatsValue: regularSeats,
    });

    // 2. Handle Files (Image & Video) with Cloudinary
    let imageUrl = null;
    let videoUrl = null;
    let imagePublicId = null;
    let videoPublicId = null;

    try {
      if (req.files && req.files.image && req.files.image[0]) {
        const imageUpload = await uploadToCloudinary(
          req.files.image[0],
          "events/images",
        );
        imageUrl = imageUpload.url;
        imagePublicId = imageUpload.public_id;
        // Clean up local file
        fs.unlinkSync(req.files.image[0].path);
      }

      if (req.files && req.files.video && req.files.video[0]) {
        const videoUpload = await uploadToCloudinary(
          req.files.video[0],
          "events/videos",
        );
        videoUrl = videoUpload.url;
        videoPublicId = videoUpload.public_id;
        // Clean up local file
        fs.unlinkSync(req.files.video[0].path);
      }
    } catch (uploadError) {
      console.error("File upload error:", uploadError);
      return res.status(500).json({
        status: "error",
        message: "File upload failed: " + uploadError.message,
      });
    }

    // 3. Validation
    if (
      !title ||
      !description ||
      !date ||
      !location ||
      !category ||
      !organizer
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "Title, description, date, location, category, and organizer are required",
      });
    }

    if (!imageUrl) {
      return res.status(400).json({
        status: "error",
        message: "Event image is required",
      });
    }

    // 4. Create Event
    const newEvent = await Event.create({
      title,
      description,
      date: new Date(date),
      location,
      category,
      vipTicketPrice: Number(viptickets),
      regularTicketPrice: Number(regulartickets),
      vipSeatCapacity: Number(vipSeats),
      regularSeatCapacity: Number(regularSeats),
      vipSeats: Number(vipSeats),
      regularSeats: Number(regularSeats),
      organizer,
      image: imageUrl,
      video: videoUrl,
      imagePublicId,
      videoPublicId,
      createdBy: req.user.id,
    });

    console.log("Event created successfully:", newEvent._id);

    // Send email notification
    try {
      console.log("Attempting to send email to:", req.user.email);
      if (req.user.email) {
        const emailResult = await sendEmail({
          to: req.user.email,
          subject: "Event Created Successfully",
          text: `Hello ${req.user.name || "User"},\n\nYour event "${newEvent.title}" has been created successfully.`,
        });
        console.log("Email sent successfully:", emailResult);
      } else {
        console.log("No user email found");
      }
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
    }

    // Optional: Email logic (commented out as per your original code)
    // ...

    res.status(201).json({
      status: "success",
      message: "Event created successfully",
      event: newEvent,
    });
  } catch (error) {
    console.error("Create event error:", error);

    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message,
      );
      return res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    res.status(500).json({
      status: "error",
      message: error.message || "Internal server error",
    });
  }
};

// put /api/event/:id
export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if event exists
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        status: "error",
        message: "Event not found",
      });
    }

    // Authorization Check
    if (
      event.createdBy.toString() !== req.user.id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        status: "error",
        message: "You are not authorized to update this event",
      });
    }

    // Handle Files: Check if new files were uploaded, otherwise keep old ones
    let imageUrl = event.image;
    let videoUrl = event.video;
    let imagePublicId = event.imagePublicId;
    let videoPublicId = event.videoPublicId;

    try {
      if (req.files && req.files.image && req.files.image[0]) {
        // Delete old image from Cloudinary if exists
        if (event.imagePublicId) {
          await deleteFromCloudinary(event.imagePublicId);
        }
        // Upload new image
        const imageUpload = await uploadToCloudinary(
          req.files.image[0],
          "events/images",
        );
        imageUrl = imageUpload.url;
        imagePublicId = imageUpload.public_id;
        // Clean up local file
        fs.unlinkSync(req.files.image[0].path);
      }

      if (req.files && req.files.video && req.files.video[0]) {
        // Delete old video from Cloudinary if exists
        if (event.videoPublicId) {
          await deleteFromCloudinary(event.videoPublicId);
        }
        // Upload new video
        const videoUpload = await uploadToCloudinary(
          req.files.video[0],
          "events/videos",
        );
        videoUrl = videoUpload.url;
        videoPublicId = videoUpload.public_id;
        // Clean up local file
        fs.unlinkSync(req.files.video[0].path);
      }
    } catch (uploadError) {
      console.error("File upload error:", uploadError);
      return res.status(500).json({
        status: "error",
        message: "File upload failed: " + uploadError.message,
      });
    }

    // Update fields only if they exist in req.body
    const {
      title,
      description,
      date,
      location,
      category,
      viptickets,
      regulartickets,
      totalSeats,
      vipSeats,
      regularSeats,
      organizer,
    } = req.body;

    event.title = title || event.title;
    event.description = description || event.description;
    event.date = date ? new Date(date) : event.date;
    event.location = location || event.location;
    event.category = category || event.category;

    // Handle numbers specifically to avoid casting issues
    if (viptickets) event.vipTicketPrice = Number(viptickets);
    if (regulartickets) event.regularTicketPrice = Number(regulartickets);
    if (totalSeats) event.totalSeats = Number(totalSeats);
    if (vipSeats) event.vipSeatCapacity = Number(vipSeats);
    if (regularSeats) event.regularSeatCapacity = Number(regularSeats);

    event.organizer = organizer || event.organizer;
    event.image = imageUrl;
    event.video = videoUrl;
    event.imagePublicId = imagePublicId;
    event.videoPublicId = videoPublicId;

    await event.save();

    // Send email notification
    try {
      if (req.user.email) {
        await sendEmail({
          to: req.user.email,
          subject: "Event Updated Successfully",
          text: `Hello ${req.user.name},\n\nYour event "${event.title}" has been updated successfully.`,
        });
      }
    } catch (emailError) {
      console.error("Email sending failed:", emailError.message);
    }

    res.status(200).json({
      status: "success",
      message: "Event updated successfully",
      event,
    });
  } catch (error) {
    console.error("Update event error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// delete /api/event/:id
export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        status: "error",
        message: "Event not found",
      });
    }

    if (
      event.createdBy.toString() !== req.user.id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        status: "error",
        message: "You are not authorized to delete this event",
      });
    }

    // Delete associated files from Cloudinary
    if (event.imagePublicId) {
      await deleteFromCloudinary(event.imagePublicId);
    }
    if (event.videoPublicId) {
      await deleteFromCloudinary(event.videoPublicId);
    }

    await Event.findByIdAndDelete(id);

    try {
      if (req.user.email) {
        await sendEmail({
          to: req.user.email,
          subject: "Event Deleted Successfully",
          text: `Hello ${req.user.name},\n\nYour event "${event.title}" has been deleted successfully.`,
        });
      }
    } catch (emailError) {
      console.error("Email sending failed:", emailError.message);
    }

    res.status(200).json({
      status: "success",
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.error("Delete event error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// POST /api/events/:id/payment - Process event payment
export const processEventPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      userId,
      userName,
      ticketType,
      ticketCount,
      totalAmount,
      paymentMethod,
    } = req.body;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        status: "error",
        message: "Event not found",
      });
    }

    const paymentRecord = {
      eventId: id,
      userId,
      userName,
      eventTitle: event.title,
      ticketType,
      ticketCount: Number(ticketCount),
      totalAmount: Number(totalAmount),
      paymentMethod,
      paymentId: `pay_${Date.now()}`,
      status: "completed",
    };

    const savedPayment = await Payment.create(paymentRecord);

    // Send ticket booking confirmation email
    try {
      if (req.user && req.user.email) {
        await sendEmail({
          to: req.user.email,
          subject: "Ticket Booking Confirmation",
          text: `Hello ${userName},\n\nYour ticket booking has been confirmed!\n\nBooking Details:\n- Event: ${event.title}\n- Ticket Type: ${ticketType}\n- Quantity: ${ticketCount}\n- Total Amount: $${totalAmount}\n- Payment ID: ${paymentRecord.paymentId}\n\nThank you for your booking!`,
        });
        console.log("Booking confirmation email sent");
      }
    } catch (emailError) {
      console.error("Booking confirmation email failed:", emailError);
    }

    res.status(200).json({
      status: "success",
      message: "Payment processed successfully",
      payment: paymentRecord,
    });
  } catch (error) {
    console.error("Payment processing error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
