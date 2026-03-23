import Booking from "../model/Booking.js";
import Event from "../model/Event.js";
import sendEmail from "../utils/sendEmail.js";

// POST /api/booking - Create ticket booking
export const createBooking = async (req, res) => {
  try {
    const { eventId, ticketType, quantity, totalAmount, email } = req.body;

    // Check event exists and get current capacity
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        status: "error",
        message: "Event not found",
      });
    }

    // Check seat availability - if requested > available, reject booking
    if (ticketType === "viptickets") {
      if (quantity > event.vipSeatCapacity) {
        return res.status(400).json({
          status: "error",
          message: `Booking failed! Only ${event.vipSeatCapacity} VIP seats available, but you requested ${quantity} tickets.`,
          availableSeats: event.vipSeatCapacity,
          requestedSeats: quantity,
        });
      }
    } else if (ticketType === "regulartickets") {
      if (quantity > event.regularSeatCapacity) {
        return res.status(400).json({
          status: "error",
          message: `Booking failed! Only ${event.regularSeatCapacity} regular seats available, but you requested ${quantity} tickets.`,
          availableSeats: event.regularSeatCapacity,
          requestedSeats: quantity,
        });
      }
    } else {
      return res.status(400).json({
        status: "error",
        message: "Invalid ticket type",
      });
    }

    const booking = await Booking.create({
      title: eventId,
      name: req.user._id,
      ticketType,
      quantity: Number(quantity),
      totalAmount,
      email,
    });

    res.status(201).json({
      status: "success",
      booking,
    });
  } catch (error) {
    console.error("Booking error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// POST /api/booking/:id/payment - Process payment
export const processPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod } = req.body; // paymentMethod might be used for actual payment gateways

    const booking = await Booking.findById(id)
      .populate("event")
      .populate("user");
    if (!booking) {
      return res.status(404).json({
        status: "error",
        message: "Booking not found",
      });
    }

    if (booking.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "Unauthorized access",
      });
    }

    if (booking.paymentStatus === "completed") {
      return res.status(400).json({
        status: "error",
        message: "Payment already completed for this booking",
      });
    }

    // Simulate payment processing
    // In a real application, you would integrate with a payment gateway (e.g., Stripe, PayPal)
    // and handle successful/failed payment responses.
    const paymentId = `pay_${Date.now()}`;

    // Deduct tickets from the event and update payment status
    const event = booking.event;
    const quantity = booking.quantity;
    const ticketType = booking.ticketType;

    if (ticketType === "viptickets") {
      if (event.vipSeatCapacity < quantity) {
        return res.status(400).json({
          status: "error",
          message: "Not enough VIP seats available",
        });
      }
      event.vipSeatCapacity -= quantity;
    } else if (ticketType === "regulartickets") {
      if (event.regularSeatCapacity < quantity) {
        return res.status(400).json({
          status: "error",
          message: "Not enough regular seats available",
        });
      }
      event.regularSeatCapacity -= quantity;
    } else {
      return res.status(400).json({
        status: "error",
        message: "Invalid ticket type",
      });
    }

    await event.save(); // Save the updated event with reduced ticket count

    // Update booking status
    booking.paymentStatus = "completed";
    booking.paymentId = paymentId;
    await booking.save();

    // Send confirmation email
    try {
      const textContent = `Hello ${
        req.user.name
      },\n\nYour ticket booking has been confirmed!\n\nBooking Details:\nEvent: ${
        booking.event.title
      }\nTicket Type: ${booking.ticketType.toUpperCase()}\nQuantity: ${
        booking.quantity
      }\nTotal Amount: $${booking.totalAmount.toFixed(-2)}\nPayment ID: ${paymentId}\n\nThank you for your booking!`;
      const htmlContent = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center;">
              <h1 style="color: #444;">Ticket Booking Confirmation</h1>
            </div>
            <div style="padding: 20px;">
              <p>Hello <strong>${req.user.name}</strong>,</p>
              <p>Your ticket booking for the event below has been confirmed. Thank you for your purchase!</p>
              <div style="border-top: 2px solid #eee; margin: 20px 0;"></div>
              <h2 style="color: #007bff;">${booking.event.title}</h2>
              <p><strong>Date:</strong> ${new Date(booking.event.date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
              <p><strong>Location:</strong> ${booking.event.location}</p>
              ${booking.event.image ? `<img src="${booking.event.image}" alt="${booking.event.title}" style="max-width: 100%; height: auto; border-radius: 4px; margin-bottom: 20px;">` : ""}
              
              <h3 style="border-bottom: 1px solid #eee; padding-bottom: 10px; margin-top: 30px;">Booking Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Ticket Type:</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${booking.ticketType.toUpperCase()}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Quantity:</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${booking.quantity}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Total Amount:</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${booking.totalAmount.toFixed(2)}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Payment ID:</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${paymentId}</td></tr>
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
        to: req.user.email,
        subject: `Your Ticket for "${booking.event.title}" is Confirmed!`,
        text: textContent,
        html: htmlContent,
      });
    } catch (emailError) {
      console.error("Email sending failed:", emailError.message);
      // Optionally, log the full error stack in development
    }

    res.status(200).json({
      status: "success",
      message: "Payment processed successfully",
      booking,
      paymentId,
    });
  } catch (error) {
    console.error("Error processing payment:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// GET /api/booking - Get user bookings
export const getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate(
        "event",
        "title date location vipTicketPrice regularTicketPrice vipSeatCapacity regularSeatCapacity vipSeats regularSeats",
      )
      .sort({ bookingDate: -1 });

    res.status(200).json({
      status: "success",
      results: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Error getting user bookings:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// GET /api/booking/event/:eventId/capacity - Get event seat capacity info
export const getEventCapacity = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId).select(
      "title vipSeatCapacity regularSeatCapacity vipSeats regularSeats",
    );

    if (!event) {
      return res.status(404).json({
        status: "error",
        message: "Event not found",
      });
    }

    const capacityInfo = {
      eventTitle: event.title,
      remainingVipSeats: event.vipSeatCapacity,
      remainingRegularSeats: event.regularSeatCapacity,
      totalRemainingSeats: event.vipSeatCapacity + event.regularSeatCapacity,
    };

    res.status(200).json({
      status: "success",
      capacity: capacityInfo,
    });
  } catch (error) {
    console.error("Error getting event capacity:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// DELETE /api/booking/:id/cancel - Cancel booking
export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id).populate("event");
    if (!booking) {
      return res.status(404).json({
        status: "error",
        message: "Booking not found",
      });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "Unauthorized access",
      });
    }

    if (booking.paymentStatus === "completed") {
      // Restore seats to event
      const event = booking.event;
      if (booking.ticketType === "viptickets") {
        event.vipSeatCapacity += booking.quantity;
      } else if (booking.ticketType === "regulartickets") {
        event.regularSeatCapacity += booking.quantity;
      }
      await event.save();
    }

    await Booking.findByIdAndDelete(id);

    // Send cancellation email
    try {
      await sendEmail({
        to: req.user.email,
        subject: "Booking Cancelled",
        text: `Hello ${req.user.name},\n\nYour booking for "${booking.event.title}" has been cancelled successfully.\n\nCancelled Booking Details:\n- Ticket Type: ${booking.ticketType}\n- Quantity: ${booking.quantity}\n- Amount: $${booking.totalAmount}\n\nThank you!`,
      });
    } catch (emailError) {
      console.error("Email sending failed:", emailError.message);
    }

    res.status(200).json({
      status: "success",
      message: "Booking cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
