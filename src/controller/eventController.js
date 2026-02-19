import sendEmail from "../utils/sendEmail.js";
import Event from "../model/Event.js";
import User from "../model/User.js";
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
    const formattedEvents = events.map((event) => ({
      ...event.toObject(),
      viptickets: event.vipTicketPrice,
      regulartickets: event.regularTicketPrice,
    }));
    res.status(200).json({
      status: "success",
      results: events.length,
      data: formattedEvents,
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
      guests,
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
    let guestsData = [];

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

      // Handle guest photos
      if (req.files && req.files.guestPhotos) {
        console.log("Guest photos received:", req.files.guestPhotos.length);
        console.log("Guests data type:", typeof guests);
        console.log("Guests data:", guests);

        let guestsArray = [];
        if (typeof guests === "string") {
          guestsArray = JSON.parse(guests);
        } else if (guests && guests[""]) {
          guestsArray = JSON.parse(guests[""]);
        } else if (Array.isArray(guests)) {
          guestsArray = guests;
        } else if (typeof guests === "object") {
          guestsArray = Object.keys(guests)
            .filter((key) => !isNaN(key))
            .map((key) => guests[key]);
        }

        console.log("Parsed guests array:", guestsArray);

        for (let i = 0; i < req.files.guestPhotos.length; i++) {
          const guestPhoto = req.files.guestPhotos[i];
          console.log("Uploading guest photo:", guestPhoto.filename);
          const photoUpload = await uploadToCloudinary(
            guestPhoto,
            "events/guests",
          );
          guestsData.push({
            name: guestsArray[i]?.name || "",
            position: guestsArray[i]?.position || "",
            photo: photoUpload.url,
            photoPublicId: photoUpload.public_id,
          });
          fs.unlinkSync(guestPhoto.path);
        }
      } else if (guests) {
        if (typeof guests === "string") {
          try {
            guestsData = JSON.parse(guests);
          } catch (e) {
            guestsData = [];
          }
        } else if (guests && guests[""]) {
          try {
            guestsData = JSON.parse(guests[""]);
          } catch (e) {
            guestsData = [];
          }
        }
      }
    } catch (uploadError) {
      console.error("File upload error:", uploadError);
      console.error("Upload error stack:", uploadError.stack);
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
      guests: guestsData,
      createdBy: req.user.id,
    });

    console.log("Event created successfully:", newEvent._id);
    console.log("Guests saved:", newEvent.guests);

    // Send email notification
    try {
      // Fetch the full user object to ensure we have the email and name
      const eventCreator = await User.findById(req.user.id);

      console.log("Attempting to send email to:", eventCreator?.email);
      if (eventCreator && eventCreator.email) {
        const textContent = `Hello ${eventCreator.name || "User"},\n\nYour event "${newEvent.title}" has been created successfully.\n\nEvent Details:\n- Title: ${newEvent.title}\n- Date: ${new Date(newEvent.date).toLocaleDateString()}\n- Location: ${newEvent.location}\n\nThank you for using our platform!`;
        const htmlContent = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #007bff; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">Event Created Successfully!</h1>
            </div>
            <div style="padding: 20px;">
              <p>Hello <strong>${eventCreator.name || "User"}</strong>,</p>
              <p>Congratulations! Your event, <strong>"${newEvent.title}"</strong>, has been successfully created and is now listed on our platform.</p>
              ${newEvent.image ? `<div style="text-align: center; margin: 20px 0;"><img src="${newEvent.image}" alt="${newEvent.title}" style="max-width: 100%; height: auto; border-radius: 4px;"></div>` : ""}
              <h3 style="border-bottom: 1px solid #eee; padding-bottom: 10px; margin-top: 20px;">Event Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Title:</td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${newEvent.title}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Date:</td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${new Date(newEvent.date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Location:</td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${newEvent.location}</td></tr>
              </table>
              <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.CLIENT_URL}/events" style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">View Your Events</a>
              </div>
            </div>
            <div style="background-color: #f4f4f4; padding: 10px; text-align: center; font-size: 0.8em; color: #777;">
              &copy; ${new Date().getFullYear()} Event Management. All rights reserved.
            </div>
          </div>
        `;
        const emailResult = await sendEmail({
          to: eventCreator.email,
          subject: `Your Event "${newEvent.title}" is Live!`,
          text: textContent,
          html: htmlContent,
        });
        console.log("Event creation email sent successfully:", emailResult);
      } else {
        console.log("No user email found to send event creation confirmation.");
      }
    } catch (emailError) {
      console.error("Event creation email sending failed:", emailError);
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
      // Fetch the full user object to ensure we have the email and name
      const eventCreator = await User.findById(req.user.id);
      if (eventCreator && eventCreator.email) {
        await sendEmail({
          to: eventCreator.email,
          subject: "Event Updated Successfully",
          text: `Hello ${eventCreator.name || "User"},\n\nYour event "${event.title}" has been updated successfully.`,
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
      // Fetch the full user object to ensure we have the email and name
      const eventCreator = await User.findById(req.user.id);
      if (eventCreator && eventCreator.email) {
        await sendEmail({
          to: eventCreator.email,
          subject: "Event Deleted Successfully",
          text: `Hello ${eventCreator.name || "User"},\n\nYour event "${event.title}" has been deleted successfully.`,
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
      // Fetch user to get their email for the confirmation
      const user = await User.findById(userId);
      if (user && user.email) {
        const textContent = `Hello ${userName},\n\nYour ticket booking has been confirmed!\n\nBooking Details:\n- Event: ${event.title}\n- Date: ${new Date(event.date).toLocaleDateString()}\n- Location: ${event.location}\n- Ticket Type: ${ticketType}\n- Quantity: ${ticketCount}\n- Total Amount: $${totalAmount}\n- Payment ID: ${paymentRecord.paymentId}\n\nThank you for your booking!`;
        const htmlContent = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center;">
              <h1 style="color: #444;">Ticket Booking Confirmation</h1>
            </div>
            <div style="padding: 20px;">
              <p>Hello <strong>${userName}</strong>,</p>
              <p>Your ticket booking for the event below has been confirmed. Thank you for your purchase!</p>
              <div style="border-top: 2px solid #eee; margin: 20px 0;"></div>
              <h2 style="color: #007bff;">${event.title}</h2>
              <p><strong>Date:</strong> ${new Date(event.date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
              <p><strong>Location:</strong> ${event.location}</p>
              ${event.image ? `<img src="${event.image}" alt="${event.title}" style="max-width: 100%; height: auto; border-radius: 4px; margin-bottom: 20px;">` : ""}
              
              <h3 style="border-bottom: 1px solid #eee; padding-bottom: 10px; margin-top: 30px;">Booking Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Ticket Type:</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${ticketType}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Quantity:</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${ticketCount}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Total Amount:</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${Number(totalAmount).toFixed(2)}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Payment ID:</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${paymentRecord.paymentId}</td></tr>
              </table>
              <div style="border-top: 2px solid #eee; margin: 20px 0;"></div>
              <p style="font-size: 0.9em; color: #777; text-align: center;">We look forward to seeing you at the event!</p>
            </div>
            <div style="background-color: #f4f4f4; padding: 10px; text-align: center; font-size: 0.8em; color: #777;">
              &copy; ${new Date().getFullYear()} Event Management. All rights reserved.
            </div>
          </div>
        `;
        await sendEmail({
          to: user.email,
          subject: `Your Ticket for "${event.title}" is Confirmed!`,
          text: textContent,
          html: htmlContent,
        });
        console.log("Booking confirmation email sent");
      } else {
        console.log(
          `Could not find email for user ${userId} to send confirmation.`,
        );
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
// DELETE or POST /api/payment/cancel/:id
export const cancelTicket = async (req, res) => {
  try {
    const { id } = req.params; // This is the Payment/Ticket ID

    // 1. Find the payment record
    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({
        status: "error",
        message: "Ticket record not found",
      });
    }

    // 2. Authorization Check: Ensure user is owner or admin
    if (
      !req.user ||
      (payment.userId.toString() !== req.user.id.toString() &&
        req.user.role !== "admin")
    ) {
      return res.status(403).json({
        status: "error",
        message: "You are not authorized to cancel this ticket.",
      });
    }

    // 2. Find the associated event
    const event = await Event.findById(payment.eventId);

    // 3. If the event still exists, add the seats back
    if (event) {
      if (payment.ticketType?.toLowerCase() === "vip") {
        event.vipSeats += payment.ticketCount;
      } else {
        // Default to regular seats
        event.regularSeats += payment.ticketCount;
      }

      // Ensure we don't exceed capacity (optional safety check)
      if (event.vipSeats > event.vipSeatCapacity)
        event.vipSeats = event.vipSeatCapacity;
      if (event.regularSeats > event.regularSeatCapacity)
        event.regularSeats = event.regularSeatCapacity;

      await event.save();
    }

    // 4. Delete the payment record (or update status to 'cancelled')
    await Payment.findByIdAndDelete(id);

    res.status(200).json({
      status: "success",
      message: "Ticket cancelled and seats returned to inventory",
    });
  } catch (error) {
    console.error("Cancellation error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
