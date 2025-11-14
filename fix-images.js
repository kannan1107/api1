import mongoose from "mongoose";
import Event from "./src/model/Event.js";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const fixImageFilenames = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Get all events
    const events = await Event.find({});
    console.log(`Found ${events.length} events`);

    // Get all files in uploads directory
    const uploadFiles = fs.readdirSync("uploads");
    console.log("Available files:", uploadFiles);

    for (const event of events) {
      if (event.image && !event.image.includes("-")) {
        // Find matching file with timestamp prefix
        const matchingFile = uploadFiles.find(
          (file) => file.includes(event.image) || file.endsWith(event.image)
        );

        if (matchingFile) {
          console.log(
            `Updating ${event.title}: ${event.image} -> ${matchingFile}`
          );
          event.image = matchingFile;
          await event.save();
        } else {
          console.log(
            `No matching file found for ${event.title}: ${event.image}`
          );
        }
      }
    }

    console.log("Image filenames updated successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

fixImageFilenames();
