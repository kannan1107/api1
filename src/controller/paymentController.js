import Payment from "../model/Payment.js";
import Event from "../model/Event.js";
import Stripe from "stripe";
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
        `Frontend price mismatch for event ${eventId}, ticketType ${ticketType}. Frontend: ${unitPrice}, Backend: ${actualUnitPrice}`
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
      if (event.vipSeatCapacity < 0 || event.regularSeatCapacity < 0) {
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
