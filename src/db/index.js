import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

async function connectDB() {
  try {
    const connectInstance = await mongoose.connect(
      `${process.env.MONGODB_URI}/${DB_NAME}`
    );
    console.log(`MongoDB connected successfully to ${connectInstance} `);
  } catch (err) {
    console.error(`Error connecting to MongoDB: ${err.message}`);
    // process.exit(1);
  }
}

export default connectDB;
