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
          requestedSeats: quantity
        });
      }
    } else if (ticketType === "regulartickets") {
      if (quantity > event.regularSeatCapacity) {
        return res.status(400).json({
          status: "error",
          message: `Booking failed! Only ${event.regularSeatCapacity} regular seats available, but you requested ${quantity} tickets.`,
          availableSeats: event.regularSeatCapacity,
          requestedSeats: quantity
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
      await sendEmail({
        to: req.user.email,
        subject: "Ticket Booking Confirmed",
        text: `Hello ${
          req.user.name
        },\n\nYour ticket booking has been confirmed!\n\nBooking Details:\nEvent: ${
          booking.event.title
        }\nTicket Type: ${booking.ticketType.toUpperCase()}\nQuantity: ${
          booking.quantity
        }\nTotal Amount: $${booking.totalAmount.toFixed(
          2
        )}\nPayment ID: ${paymentId}\n\nThank you for your booking!`,
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
        "title date location vipTicketPrice regularTicketPrice vipSeatCapacity regularSeatCapacity vipSeats regularSeats"
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
      "title vipSeatCapacity regularSeatCapacity vipSeats regularSeats"
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
