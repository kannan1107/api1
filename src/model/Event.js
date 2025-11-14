import mongoose, { Schema } from "mongoose";





const eventSchema = Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    category:{
        type: String,
        required: true,
        trim: true
    },
    date: {
        type: Date,
        required: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    image: {
        type: String,
        default: null,
        trim: true,
        
    },
    video: {
        type: String,
        default: null,
        trim: true,

    },
    location: {
        type: String,
        required: true,
        trim: true
    },
    organizer: {
        type: String,
        required: true,
        trim: true
    },
    viptickets: {
        type: Number,
        required: true,
        min: 0
    },
    regulartickets: {
        type: Number,
        required: true,
        min: 0
    },
    totalSeats: {
        type: Number,
        default: 100,
    },
    createdBy:{
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    attendees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now }
});

const Event = mongoose.model('Event', eventSchema);

export default Event;