// require("dotenv").config({ path: "./env" });
import dotenv from "dotenv";

import connectDB from "./db/index.js";

dotenv.config(); // If your .env file is in the root directory

connectDB();
