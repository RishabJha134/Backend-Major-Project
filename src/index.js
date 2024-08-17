// require("dotenv").config({ path: "./env" });
import dotenv from "dotenv";

import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config(); // If your .env file is in the root directory

connectDB()
  .then(() => {
    app.listen(process.env.PORT || 8000, () => {
      
      console.log(`Server running on port ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.error(`Error connecting to database: ${err.message}`);
    // process.exit(1);  // Exit with error code 1 in case of failure
  });
