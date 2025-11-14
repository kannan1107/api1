import express from 'express';
import { createBooking, processPayment, getUserBookings } from '../controller/bookingController.js';
import { protect } from '../middleware/authmiddleware.js';

const router = express.Router();

// Test route (no auth required)
router.get('/test', (req, res) => {
    res.json({ message: 'Booking routes working!' });
});

// Simple POST test (no auth required)
router.post('/simple-test', (req, res) => {
    console.log('Simple test body:', req.body);
    res.json({ 
        message: 'POST working!', 
        receivedBody: req.body 
    });
});

// Create booking without auth (for testing)
router.post('/create', async (req, res) => {
    try {
        const { eventId, ticketType, quantity } = req.body;
        
        const booking = {
            eventId,
            ticketType,
            quantity,
            totalPrice,
            name,
            email, // Example price calculation
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          
        };

        res.status(201).json({
            status: "success",
            booking
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// All routes require authentication
router.use(protect);

// POST /api/booking - Create booking
router.post('/', (req, res, next) => {
    console.log('POST /api/booking route hit!');
    next();
}, createBooking);

// POST /api/booking/:id/payment - Process payment
router.post('/:id/payment', processPayment);

// GET /api/booking - Get user bookings
router.get('/', getUserBookings);

console.log('Booking routes loaded successfully');

export default router;