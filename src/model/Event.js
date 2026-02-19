import mongoose, { Schema } from "mongoose";

const eventSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, "Event date is required"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    image: {
      type: String,
      trim: true,
      default: "",
    },
    video: {
      type: String,
      trim: true,
      default: "",
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
    },
    organizer: {
      type: String,
      required: [true, "Organizer name is required"],
      trim: true,
    },
    vipTicketPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    regularTicketPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    vipSeatCapacity: {
      type: Number,
      required: true,
      min: 0,
    },
    regularSeatCapacity: {
      type: Number,
      required: true,
      min: 0,
    },
    totalSeats: {
      type: Number,
      default: 0,
    },
    vipSeats: {
      type: Number,
      default: 0,
    },
    regularSeats: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    attendees: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

eventSchema.virtual("availableVipSeats").get(function () {
  return this.vipSeats;
});

eventSchema.virtual("availableRegularSeats").get(function () {
  return this.regularSeats;
});

eventSchema.virtual("availableTickets").get(function () {
  return this.vipSeats + this.regularSeats;
});

eventSchema.pre("save", function (next) {
  if (this.vipSeatCapacity || this.regularSeatCapacity) {
    this.totalSeats =
      (this.vipSeatCapacity || 0) + (this.regularSeatCapacity || 0);
  }

  if (this.isNew) {
    if (this.vipSeats === undefined || this.vipSeats === null) {
      this.vipSeats = this.vipSeatCapacity || 0;
    }
    if (this.regularSeats === undefined || this.regularSeats === null) {
      this.regularSeats = this.regularSeatCapacity || 0;
    }
  }

  next();
});

const Event = mongoose.model("Event", eventSchema);

export default Event;
