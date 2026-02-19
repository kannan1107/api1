import Payment from "../model/Payment.js";
import Event from "../model/Event.js";
import Stripe from "stripe";
import sendEmail from "../utils/sendEmail.js";
import Dotenv from "dotenv";

Dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const toCents = (amount) => Math.round(parseFloat(amount) * 100);

export const createStripeCheckoutSession = async (req, res) => {
  const {
    eventId,
    ticketType,
    ticketCount,
    unitPrice,
    totalAmount,
    eventTitle,
    userEmail,
    userId,
  } = req.body;

  try {
    // 1. Validate incoming data
    if (
      !eventId ||
      !ticketType ||
      !ticketCount ||
      !unitPrice ||
      !totalAmount ||
      !eventTitle
    ) {
      return res
        .status(400)
        .json({ message: "Missing required fields for Stripe Checkout." });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }

    const actualUnitPrice = event.ticketPrices[ticketType]; // Assuming event has a ticketPrices object
    if (toCents(actualUnitPrice) !== toCents(unitPrice)) {
      console.warn(
        `Frontend price mismatch for event ${eventId}, ticketType ${ticketType}. Frontend: ${unitPrice}, Backend: ${actualUnitPrice}`,
      );
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${ticketType} Ticket for ${eventTitle}`,
              description: `Event ID: ${eventId}`,
            },
            unit_amount: toCents(unitPrice),
          },
          quantity: Number(ticketCount),
        },
      ],
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}&eventId=${eventId}&userId=${userId}`,
      cancel_url: `${process.env.CLIENT_URL}/payment-failed`,
      customer_email: userEmail || undefined,
      client_reference_id: userId,
      metadata: {
        eventId: eventId,
        userId: userId,
        ticketType: ticketType,
        ticketCount: ticketCount,
        eventTitle: eventTitle,
      },
    });

    res.status(200).json({ id: session.id });
  } catch (error) {
    console.error("Error creating Stripe Checkout session:", error);
    res.status(500).json({
      message: "Failed to create Stripe Checkout session",
      error: error.message,
    });
  }
};

// Your existing createPayment function (for recording a successful payment after it's processed)
export const createPayment = async (req, res) => {
  const {
    eventId,
    ticketType,
    ticketCount,
    unitPrice,
    totalAmount,
    eventTitle,
    userEmail,
    userId,
    paymentMethod,
    paymentId,
    status,
  } = req.body || {};

  try {
    console.log("=== RECORD PAYMENT FUNCTION CALLED ===");
    console.log("Request body:", req.body);

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        status: "error",
        message: "Event not found",
      });
    }

    console.log("Event found:", event);

    // resolve user info
    const resolvedUserId = req.user?.id || userId;
    const resolvedUserName =
      req.user?.name || req.body.userName || req.body.name || "Guest";
    const resolvedEventTitle =
      event.title || eventTitle || req.body.Title || "Untitled Event";

    const paymentData = {
      eventId,
      userId: resolvedUserId,
      // ensure schema-required fields are present (Title and name)
      Title: resolvedEventTitle, // matches schema 'Title'
      name: resolvedUserName, // matches schema 'name'
      userName: resolvedUserName, // keep legacy field if used elsewhere
      eventTitle: resolvedEventTitle,
      ticketType: ticketType || "regulartickets",
      ticketCount: Number(ticketCount) || 1,
      unitPrice: Number(unitPrice) || 0,
      totalAmount: Number(totalAmount),
      paymentMethod: paymentMethod || "Stripe",
      paymentId: paymentId || `pay_${Date.now()}`,
      status: status || "completed",
      email: userEmail || req.user?.email || undefined,
    };

    const payment = await Payment.create(paymentData);

    if (event) {
      // Update event's vipSeatCapacity or regularSeatCapacity based on ticketType
      if (ticketType === "VIP") {
        event.vipSeats -= Number(ticketCount);
      } else if (ticketType === "Regular") {
        event.regularSeats -= Number(ticketCount);
      } else {
        return res.status(400).json({
          status: "error",
          message: "Invalid ticket type",
        });
      }
      if (event.vipSeats < 0 || event.regularSeats < 0) {
        return res.status(400).json({
          status: "error",
          message: "Not enough seats available",
        });

        // Save the updated event
        await event.save();
        return res.status(400).json({
          status: "error",
          message: "Not enough seats available",
        });
      }

      await event.save();
    }

    // Send confirmation email
    try {
      if (paymentData.email) {
        const textContent = `Hello ${paymentData.userName},\n\nYour ticket booking has been confirmed!\n\nBooking Details:\n- Event: ${event.title}\n- Date: ${new Date(event.date).toLocaleDateString()}\n- Location: ${event.location}\n- Ticket Type: ${paymentData.ticketType}\n- Quantity: ${paymentData.ticketCount}\n- Total Amount: $${paymentData.totalAmount.toFixed(2)}\n- Payment ID: ${paymentData.paymentId}\n\nThank you for your booking!`;
        const htmlContent = `
              <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #f4f4f4; padding: 20px; text-align: center;">
                  <h1 style="color: #444;">Ticket Booking Confirmation</h1>
                </div>
                <div style="padding: 20px;">
                  <p>Hello <strong>${paymentData.userName}</strong>,</p>
                  <p>Your ticket booking for the event below has been confirmed. Thank you for your purchase!</p>
                  <div style="border-top: 2px solid #eee; margin: 20px 0;"></div>
                  <h2 style="color: #007bff;">${event.title}</h2>
                  <p><strong>Date:</strong> ${new Date(event.date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
                  <p><strong>Location:</strong> ${event.location}</p>
                  ${event.image ? `<img src="${event.image}" alt="${event.title}" style="max-width: 100%; height: auto; border-radius: 4px; margin-bottom: 20px;">` : ""}
                  
                  <h3 style="border-bottom: 1px solid #eee; padding-bottom: 10px; margin-top: 30px;">Booking Details</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Ticket Type:</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${paymentData.ticketType}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Quantity:</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${paymentData.ticketCount}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Total Amount:</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${paymentData.totalAmount.toFixed(2)}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Payment ID:</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${paymentData.paymentId}</td></tr>
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
          to: paymentData.email,
          subject: `Your Ticket for "${event.title}" is Confirmed!`,
          text: textContent,
          html: htmlContent,
        });
        console.log("Booking confirmation email sent to", paymentData.email);
      }
    } catch (emailError) {
      console.error("Error sending payment confirmation email:", emailError);
    }

    res.status(201).json({
      status: "success",
      message: "Payment recorded successfully",
      payment,
    });
  } catch (error) {
    console.error("Error recording payment:", error);
    if (error && error.errors)
      console.error("Validation errors:", error.errors);
    res.status(500).json({
      status: "error",
      message: error?.message || String(error),
      error,
    });
  }
};

export const getUserPayments = async (req, res) => {
  try {
    const userId = req.user.id;
    const payments = await Payment.find({ userId })
      .populate("eventId", "title date location")
      .populate("userId", "name email");

    res.status(200).json({
      status: "success",
      payments,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate("eventId", "title date location")
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: "success",
      payments,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate("eventId", "title date location")
      .populate("userId", "name email");

    if (!payment) {
      return res.status(404).json({
        status: "error",
        message: "Payment not found",
      });
    }

    res.status(200).json({
      status: "success",
      payment,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const cancelPayment = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findById(id).populate("eventId");
    if (!payment) {
      return res.status(404).json({
        status: "error",
        message: "Payment not found",
      });
    }

    if (payment.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "Unauthorized access",
      });
    }

    // Restore seats to event
    const event = payment.eventId;
    if (event) {
      console.log("Payment data:", {
        ticketType: payment.ticketType,
        vipticket: payment.vipticket,
        regularticket: payment.regularticket,
        ticketCount: payment.ticketCount,
      });
      console.log("Before cancellation:", {
        vipSeats: event.vipSeats,
        regularSeats: event.regularSeats,
        vipCapacity: event.vipSeatCapacity,
        regularCapacity: event.regularSeatCapacity,
      });

      if (payment.ticketType === "VIP" || payment.vipticket) {
        event.vipSeats += payment.ticketCount;
        console.log(`Adding ${payment.ticketCount} VIP seats`);
      } else if (
        payment.ticketType === "Regular" ||
        payment.ticketType === "regulartickets" ||
        payment.regularticket
      ) {
        event.regularSeats += payment.ticketCount;
        console.log(`Adding ${payment.ticketCount} Regular seats`);
      }

      await event.save();

      console.log("After cancellation:", {
        vipSeats: event.vipSeats,
        regularSeats: event.regularSeats,
        vipCapacity: event.vipSeatCapacity,
        regularCapacity: event.regularSeatCapacity,
        restoredCount: payment.ticketCount,
      });
    }

    await Payment.findByIdAndDelete(id);

    res.status(200).json({
      status: "success",
      message: `Ticket cancelled successfully. Refund of $${payment.totalAmount} will be processed within 5-7 business days.`,
      refundAmount: payment.totalAmount,
      restoredSeats: payment.ticketCount,
      availableSeats: {
        vipSeats: event.vipSeatCapacity,
        regularSeats: event.regularSeatCapacity,
        totalAvailable: event.vipSeatCapacity + event.regularSeatCapacity,
      },
    });
  } catch (error) {
    console.error("Error cancelling payment:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
