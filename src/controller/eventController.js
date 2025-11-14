import sendEmail from "../utils/sendEmail.js";
import Event from "../model/Event.js";
import Payment from "../model/Payment.js";

// get /api/event all
export const getAllEvents = async (req, res) => {
  try {
    console.log("GET /api/events called");
    const events = await Event.find();
    console.log("Found events:", events.length);
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
    console.log("Request body:", req.body);
    console.log("User (from req.user):", req.user);

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        status: "error",
        message:
          "Authentication failed: User information is missing or incomplete.",
      });
    }

    if (!req.body) {
      return res.status(400).json({
        status: "error",
        message:
          "Request body is missing. Please send data as JSON, not multipart/form-data",
      });
    }

    const {
      title,
      description,
      date,
      location,
      category,
      viptickets,
      regulartickets,
      totalSeats,
      organizer,
      image,
      video,
    } = req.body;

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

    if (!viptickets || !regulartickets) {
      return res.status(400).json({
        status: "error",
        message: "VIP tickets and regular tickets prices are required",
      });
    }

    console.log(req.files.image[0]);
    const newEvent = await Event.create({
      title,
      description,
      date: new Date(date),
      location,
      category,
      viptickets,
      regulartickets,
      totalSeats,
      organizer,
      image: req.files.image[0].filename,
      video: video || null,
      createdBy: req.user.id,
    });

    console.log("Event created successfully:", newEvent._id);

    // try {
    //   console.log("Attempting to send email to:", req.user.email);
    //   await sendEmail({
    //     to: req.user.email,
    //     subject: "Event Created Successfully",
    //     text: `Hello ${req.user.name},\n\nYour event "${title}" has been created successfully.\n\nEvent Details:\nTitle: ${title}\nDescription: ${description}\nDate: ${date}\nLocation: ${location}\nCategory: ${category}\nVIP Tickets: ${viptickets}\nRegular Tickets: ${regulartickets}\nTotal Seats: ${totalSeats}\nOrganizer: ${organizer}\n\nThank you for using our Event Management System!`,
    //   });
    //   console.log("Email sent successfully!");
    // } catch (emailError) {
    //   console.error("Email sending failed:", emailError.message);
    //   console.error("Full email error:", emailError);
    // }

    res.status(201).json({
      status: "success",
      message: "Event created successfully",
      event: newEvent,
    });
  } catch (error) {
    console.error("Create event error:", error);

    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message
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
    console.log("UPDATE EVENT - Raw body:", req.body);
    console.log("UPDATE EVENT - Body keys:", Object.keys(req.body));

    const { id } = req.params;
    const {
      title,
      description,
      date,
      location,
      category,
      viptickets,
      regulartickets,
      totalSeats,
      organizer,
      image,
      video,
    } = req.body;
    console.log("Received image URL in createEvent:", image);

    // Clean up field names and handle singular/plural forms
    const cleanBody = {};
    Object.keys(req.body).forEach((key) => {
      const cleanKey = key.trim();
      // Handle field name variations
      if (cleanKey === "vipticket") {
        cleanBody["viptickets"] = req.body[key];
      } else {
        cleanBody[cleanKey] = req.body[key];
      }
    });

    console.log("Cleaned body:", cleanBody);

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
        message: "You are not authorized to update this event",
      });
    }

    event.title = cleanBody.title || title || event.title;
    event.description =
      cleanBody.description || description || event.description;
    event.date = cleanBody.date || date || event.date;
    event.location = cleanBody.location || location || event.location;
    event.category = cleanBody.category || category || event.category;
    event.viptickets = cleanBody.viptickets || viptickets || event.viptickets;
    event.regulartickets =
      cleanBody.regulartickets || regulartickets || event.regulartickets;
    event.totalSeats = cleanBody.totalSeats || totalSeats || event.totalSeats;
    event.organizer = cleanBody.organizer || organizer || event.organizer;
    event.image = cleanBody.image || image || event.image;
    event.video = cleanBody.video || video || event.video;

    await event.save();

    // Send email after successful update
    try {
      if (req.user.email) {
        await sendEmail({
          to: req.user.email,
          subject: "Event Updated Successfully",
          text: `Hello ${req.user.name},\n\nYour event "${event.title}" has been updated successfully.\n\nThank you for using our Event Management System!`,
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
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// delete /api/event/:id
export const deleteEvent = async (req, res) => {
  try {
    console.log("DELETE EVENT called for ID:", req.params.id);
    const { id } = req.params;

    const event = await Event.findById(id);
    if (!event) {
      console.log("Event not found:", id);
      return res.status(404).json({
        status: "error",
        message: "Event not found",
      });
    }

    console.log("Event found, checking permissions");
    if (
      event.createdBy.toString() !== req.user.id.toString() &&
      req.user.role !== "admin"
    ) {
      console.log("Permission denied for user:", req.user.id);
      return res.status(403).json({
        status: "error",
        message: "You are not authorized to delete this event",
      });
    }

    console.log("Deleting event:", event.title);
    await Event.findByIdAndDelete(id);

    // Send email after successful deletion
    try {
      if (req.user.email) {
        await sendEmail({
          to: req.user.email,
          subject: "Event Deleted Successfully",
          text: `Hello ${req.user.name},\n\nYour event "${event.title}" has been deleted successfully.\n\nThank you for using our Event Management System!`,
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
    console.log("PAYMENT REQUEST for event:", req.params.id);
    console.log("Payment data:", req.body);

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

    // Save payment to database
    const savedPayment = await Payment.create(paymentRecord);
    console.log("Payment saved to database:", savedPayment._id);

    console.log("Sending payment response:", paymentRecord);

    res.status(200).json({
      status: "success",
      message: "Payment processed successfully",
      payment: paymentRecord,
    });

    console.log("Payment response sent successfully");
  } catch (error) {
    console.error("Payment processing error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
