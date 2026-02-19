import mongoose, { Schema } from "mongoose";

const bookingSchema = Schema({
    title: {
        type: String,
        required: true

       
    },
    name: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    ticketType: {
        type: String,
        enum: ['viptickets', 'regulartickets'],
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    paymentId: {
        type: String,
        default: null
    },
    bookingDate: {
        type: Date,
        default: Date.now
    }
});

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;
