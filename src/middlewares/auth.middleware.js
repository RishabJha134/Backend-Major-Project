import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

export const verifyJWT = asyncHandler(async (req, res, next) => {
  try {
    // Log headers and cookies for debugging
    console.log("Headers:", req.headers);
    console.log("Cookies:", req.headers.cookie);

    // Extract token from cookies or Authorization header
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

    // Log the extracted token
    console.log("Extracted Token:", token);

    // Validate that the token is a non-empty string
    if (!token || typeof token !== "string" || token.trim() === "") {
      throw new ApiError(401, "Unauthenticated request: Invalid or missing token");
    }

    // Verify the token
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // Log decoded token for debugging
    console.log("Decoded Token:", decodedToken);

    // Find the user associated with the token
    const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

    // If no user is found, throw an error
    if (!user) {
      throw new ApiError(401, "Invalid token: User not found");
    }

    // Attach the user to the request object
    req.user = user;
    next();
  } catch (error) {
    // Log the error for debugging
    console.error("verifyJWT middleware error:", error);

    // Throw an appropriate ApiError
    throw new ApiError(401, error?.message || "Invalid token");
  }
});
