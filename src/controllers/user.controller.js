import { asyncHandler } from "../utils/asyncHandler.js";
import { z } from "zod";
import { ApiError } from "../utils/ApiError.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { User } from "./../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// Define a Zod schema for user details
const userSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters long"),
  email: z.string().email("Please enter a valid email address"),
  username: z.string().min(2, "Username must be at least 3 characters long"),
  password: z.string().min(2, "Password must be at least 6 characters long"),
});

const registerUser = asyncHandler(async (req, res) => {
  // Step 0: Get user details from frontend
  const { fullName, email, username, password } = req.body;
  console.log(fullName);

  // ----------------------------------------------------------------

  // Step 1: Validation
  try {
    // Validate the request body using the schema
    const validatedData = userSchema.parse(req.body);
    console.log(validatedData);

    // If you want to handle only errors at this stage,
    // you can simply acknowledge that validation passed
    // res
    //   .status(200)
    //   .json({ message: "Data validated successfully!", data: validatedData });
  } catch (err) {
    if (err instanceof z.ZodError) {
      // Send back error messages if validation fails
      return res.status(400).json({ errors: err.errors.map((e) => e.message) });
    }
    // Handle any other errors
    res.status(500).send("Internal Server Error");
  }

  // if (
  //   [fullName, email, username, password].some((field) => field?.trim() === "")
  // ) {
  //   throw new ApiError(400, "All fields are required");
  // }

















  // ----------------------------------------------------------------
  // step2:- check if user exist or not:-
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "user with email or username already exists");
  }
  console.log(existedUser);











  
  // ----------------------------------------------------------------
  //   step3:- check for images and check for avatar in local path :-
  const avatarLocalPath = req.files?.avatar[0]?.path;
  
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  

  // we check only beacuse avatar is required field:-
  if (!avatarLocalPath) {
    throw new ApiError(
      400,
      "Please provide an avatar or cover image by user in input field"
    );
  }

  // ----------------------------------------------------------------
  //   step4:- upload images to cloudinary:-
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
 
  // we check only beacuse avatar is required field:-
  if (!avatar) {
    throw new ApiError(400, "Failed to upload images to cloudinary");
  }

  // ----------------------------------------------------------------
  // step5:- create new object and put in database:-
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage:  coverImage? coverImage.url : "",
  
    email,
    password,
    username: username.toLowerCase(),
  });

  console.log(user);

  // step6:- remove password and refresh token field from response:-  // hum user ko password and refreshToken nahi dena chahte hai.
  const createdUser = await User.findOne(user._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) {
    throw new ApiError(500, "something went wrong while registration the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

export { registerUser };
