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

const generateAccessAndRefereshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // save refresh token in database:- access token,refresh token to hum user ko dedete hai but refresh token hum apne database me bhi save karke rakhte hai taaki user se baar baar password nh puchna pade.
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating referesh and access token"
    );
  }
};

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
    coverImage: coverImage ? coverImage.url : "",

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

const loginUser = asyncHandler(async (req, res) => {
  // todo:-
  // step1:- get email and password from frontend by req.body from login page:-
  // step2:- add validation checks:- and find user check is it in database or not:-
  // step3:- compare login input password and database saved hashed password:-
  // step4:- if true -> generate access token and refresh token:- else return error:-
  // step5:- send access token and refresh token in frontend by help of cookies:-
  // step6:- return response:-

  // step1:-get email and password from frontend by req.body from login page
  const { email, username, password } = req.body;

  // step2:- add validation checks:-
  if (!(email || username)) {
    throw new ApiError(400, "Please provide email or username");
  }

  // step3:-find user check is it in database or not:-
  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    throw new ApiError(401, "user does not exist");
  }

  // step4:- compare login input password and database saved hashed password:-
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid password");
  }

  // step5:- generate access token and refresh token
  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
    user._id
  );

  // optional step only update logged in user:-
  // we dont want to send password and refresh token to the user frontend after login:-
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // step6:- send access token and refresh token in frontend by help of cookies:-
  const options = {
    httpOnly: true,
    secure: true,
  };

  res.cookie("accessToken", accessToken, options);
  res.cookie("refreshToken", refreshToken, options);

  // why send access token and refresh token?
  // because for mobile app there is no cookies set  then this is important and required:-
  // because khud apni taraf se want to save access token and refresh token in local storage or any other reason:-

  return res.json(
    new ApiResponse(
      200,
      {
        user: loggedInUser,
        accessToken,
        refreshToken,
      },
      "User logged In Successfully"
    )
  );
});

const logoutUser = asyncHandler(async (req, res) => {
  // step1:- remove cookies access token and refresh token from user frontend:-
  // step2:- jo refresh token humne user ke andar database me save karwaya tha line no 25 me save karwaya the usko bhi to remove karna hoga sir.
  const userAfterLogout = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set:{
        refreshToken:undefined,
      }
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  res.clearCookie("accessToken", options);
  res.clearCookie("refreshToken", options);

  return res.status(200).json(new ApiResponse(200, {}, "User logged Out"));
});

export { registerUser, loginUser, logoutUser };

// why send access token and refresh token?
// if user refresh the page or close the browser then access token will be expired and user will be logged out.
// so by storing refresh token in cookies we can get access token when user refresh the page or close the browser.
// so that we can automatically login user after refresh the page.
