import { asyncHandler } from "../utils/asyncHandler.js";
import { z } from "zod";
import { ApiError } from "../utils/ApiError.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { User } from "./../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

// Define a Zod schema for user details
const userSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters long"),
  email: z.string().email("Please enter a valid email address"),
  username: z.string().min(2, "Username must be at least 2 characters long"),
  password: z.string().min(2, "Password must be at least 2 characters long"),
});

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    // Save refresh token in the database:
    // We give the user both the access and refresh tokens, but we also save the refresh token in our database so that the user doesn’t need to re-enter their password repeatedly.
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    console.log("from controller: " + accessToken, refreshToken);
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access tokens"
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
    return res.status(500).send("Internal Server Error");
  }

  // ----------------------------------------------------------------
  // Step 2: Check if user exists or not:
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }
  console.log(existedUser);

  // ----------------------------------------------------------------
  // Step 3: Check for images and check for avatar in local path:
  const avatarLocalPath = req.files?.avatar[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  // We check only because the avatar is a required field:
  if (!avatarLocalPath) {
    throw new ApiError(
      400,
      "Please provide an avatar or cover image in the input field"
    );
  }

  // ----------------------------------------------------------------
  // Step 4: Upload images to Cloudinary:
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = coverImageLocalPath
    ? await uploadOnCloudinary(coverImageLocalPath)
    : null;

  // We check only because the avatar is a required field:
  if (!avatar) {
    throw new ApiError(400, "Failed to upload images to Cloudinary");
  }

  // ----------------------------------------------------------------
  // Step 5: Create a new object and put it in the database:
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage ? coverImage.url : "",
    email,
    password,
    username: username.toLowerCase(),
  });

  console.log(user);

  // Step 6: Remove password and refresh token fields from the response:
  // We don’t want to send the password and refresh token to the user.
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // TODO:
  // Step 1: Get email and password from frontend via req.body from login page:
  // Step 2: Add validation checks and find user in the database:
  // Step 3: Compare login input password and database saved hashed password:
  // Step 4: If true -> generate access token and refresh token, else return error:
  // Step 5: Send access token and refresh token to frontend via cookies:
  // Step 6: Return response:

  // Step 1: Get email and password from frontend via req.body from login page
  const { email, username, password } = req.body;
  console.log(email, username, password);

  // Step 2: Add validation checks:
  if (!(email || username)) {
    throw new ApiError(400, "Please provide email or username");
  }

  // Step 3: Find user in the database:
  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    throw new ApiError(401, "User does not exist");
  }

  // Step 4: Compare login input password and database saved hashed password:
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid password");
  }

  // Step 5: Generate access token and refresh token
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );
  console.log("Access token -> from controller:", accessToken, refreshToken);

  // Optional: Only update the logged-in user:
  // We don’t want to send the password and refresh token to the frontend after login:
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // Step 6: Send access token and refresh token to frontend via cookies:
  const options = {
    httpOnly: true,
    secure: true,
  };

  res.cookie("accessToken", accessToken, options);
  res.cookie("refreshToken", refreshToken, options);

  // Why send access token and refresh token?
  // Because for mobile apps, cookies are not set, so this is important and required.
  // Users may want to save the access token and refresh tokenimport { bcrypt } from 'bcrypt';
 in local storage or for any other reason.

  return res.json(
    new ApiResponse(
      200,
      {
        user: loggedInUser,
        accessToken,
        refreshToken,
      },
      "User logged in successfully"
    )
  );
});

const logoutUser = asyncHandler(async (req, res) => {
  // Step 1: Remove access token and refresh token cookies from frontend:
  // Step 2: We also need to remove the refresh token that we saved in the user's database record (see line 25).
  const userAfterLogout = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
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

  return res.status(200).json(new ApiResponse(200, {}, "User logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {

  // ----------------------------------------------------------------
  // step1:- recieve incoming Refresh Token from frontend:-
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken; // req.body for andriod mobile app:-
  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized request"); // because refresh token wahi send kr sakta hai frontend se jo login hoga matlab authorized hoga:-
  }




  // ----------------------------------------------------------------
  // step2:- verify incoming Refresh Token which is coming from frontend is it valid or not:-
  try {
    const decodedToken = await jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "Invalid refresh token"); //because refresh token verification is failed.
    }
  
  
  
  
  
  
  
    // ----------------------------------------------------------------
    // step3:- check incoming Refresh Token jo frontend se aarha hai aur refresh token jo humne database me save karwaya tha generate karte time:-
  
    if(incomingRefreshToken !== user?.refreshToken){
      throw new ApiError(401, "refresh token is expired or used or not valid"); 
  
  
    }
  
    // ----------------------------------------------------------------
    // step4:- if refresh token is valid then generate a new access token and new refresh token save it in the database:-
    const options={
      httpOnly:true,
      secure:true,
    }
  
    const {accessToken,newRefreshToken} = await generateAccessAndRefreshTokens(user._id);
  
    res.cookie("accessToken",accessToken,options);
    res.cookie("refreshToken",newRefreshToken,options);
  
    return res.status(200).json(
      new ApiResponse(
        200,{
          accessToken,
          refreshToken:newRefreshToken,
          
        },
        "AccessToken refreshed"
      )
    )
  } catch (error) {
    console.error("Error while refreshing access token:", error);
    throw new ApiError(401, "Error while refreshing access token");
    
  }

});


const changeCurrentPassword = asyncHandler(async(req,res)=>{
  const {oldPassword,newPassword} = req.body;

  const user = await User.findById(req.user?._id)
  console.log(user);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if(!isPasswordCorrect){
    throw new ApiError(401, "Invalid old password");
  }

  user.password = newPassword;  
  await user.save({validateBeforeSave:false});  // database me kuch bhi save karne se pehle userSchema.pre("save", async function (next) this function is trigger in user.model.js:-

  return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"));
})


const getCurrentUser = asyncHandler(async(req,res)=>{
  return res.status(200).json( new ApiResponse(200,req.user,"current user fetched successfully"));
})



const updateAccountDetails = asyncHandler(async(req,res)=>{
  const {fullName, email} = req.body;
  if(!fullName || !email){
    throw new ApiError(400, "Please provide full name and email");
  }

  const user =  await User.findByIdAndUpdate(
    req.user?._id,
    {

      $set:{
        fullName:fullName,
        email:email
      }
      
    },
    {
      new: true
    }


  )

  return res.status(200).json(new ApiResponse(200,user,"Account details updated successfully"))

})





const updateUserAvatar = asyncHandler(async(req,res)=>{
const avatarLocalPath =  req.file?.path

if(!avatarLocalPath){
  throw new ApiError(400, "Please provide an avatar file");

}

const avatar = await uploadOnCloudinary(avatarLocalPath);

if(!avatar.url){
  throw new ApiError(400, "Error uploading avatar to cloudinary");
}


const user = await User.findByIdAndUpdate(
  req.user?._id,
  {
    $set:{
      avatar:avatar.url
    }
  },
  {
    new:true
  }
).select("-password")

return res.status(200).json(new ApiResponse(200,user,"Avatar updated successfully"))

})

const updateUserCoverImage = asyncHandler(async(req,res)=>{
const coverImageLocalPath =  req.file?.path

if(!coverImageLocalPath){
  throw new ApiError(400, "Please provide an coverImage file");

}

const coverImage = await uploadOnCloudinary(coverImageLocalPath);

if(!coverImage.url){
  throw new ApiError(400, "Error uploading coverImage to cloudinary");
}


const user = await User.findByIdAndUpdate(
  req.user?._id,
  {
    $set:{
      coverImage:coverImage.url
    }
  },
  {
    new:true
  }
).select("-password")

return res.status(200).json(new ApiResponse(200,user,"Cover image updated successfully"))

})




const getUserChannelProfile = asyncHandler(async (req,res)=>{

  // find the username of the channel:-
  const {username} = req.params;
  if(!username?.trim()){
    throw new ApiError(400, "Please provide a valid username");
  }

  const channel = await User.aggregate([

    // pipeline 1.
    {
      $match:{
        username:username?.toLowerCase()
      }
    },

    // internally it returns the user_id which matches the username:- here user_id:123abc

    // pipeline 2.  for find total subsribers:- we have to find total kitne channel ne is user_id = 123abc  ko subscribe kar rakha hai.
    {
      $lookup:{
        from:"subscriptions",
        localField:"_id",
        foreignField:"channel",
        as:"subscribers"
      }
    },

    // pipeline 3. for find total total kitne channel ko is user_id = 123abc ne susbcsiber kar rakha hai.
    // user_id=123abc ne total kitne ko subscribe kar rakha hai.

    {
      $lookup:{
        from:"subscriptions",
        localField:"_id",
        foreignField:"subscriber",
        as:"subscribed to"
      }
    },

    // pipeline 4:- add fields of subscribersCount of user_id=123,abc , channelsSubscribedToCount by user_id=123abc , isSubscribed:-
    {
      $addFields: {
        subscribersCount: {
            $size: "$subscribers"
        },
        channelsSubscribedToCount: {
            $size: "$subscribedTo"
        },
        isSubscribed: {
            $cond: {
                if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                then: true,
                else: false
            }
        }
    }
      
    },
    // pipeline 5:- hum jis jis filed ko show karwana chahte hai:-
    {
      $project: {
          fullName: 1,
          username: 1,
          subscribersCount: 1,
          channelsSubscribedToCount: 1,
          isSubscribed: 1,
          avatar: 1,
          coverImage: 1,
          email: 1

      }
  }

  ])

  console.log(channel);

  if (!channel?.length) {
    throw new ApiError(404, "channel does not exists")
}

return res
.status(200)
.json(
    new ApiResponse(200, channel[0], "User channel fetched successfully")
)
})


const getWatchHistory = asyncHandler(async(req,res)=>{
  const user = await User.aggregate([
    {
      $match:{
        _id: new mongoose.Types.ObjectId(req.user._id)
      }

    },

    {
      $lookup:{
        from:"video",
        localField:"watchHistory",
        foreignField:"_id",
        as:"watchHistory",


        pipeline:[
          {
            $lookup:{
              from:"users",
              localField:"owner",
              foreignField:"_id",
              as:"owner",

              pipeline:[
                {
                  $project:{
                    fullName:1,
                    username:1,
                    avatar:1
                  }
                }
              ]
            }

          },
          {
            $addFields:{
              owner:{
                $first:"$owner"
              }
            }
          }

        ]



      }

    },

   

  ])


  return res
  .status(200)
  .json(
      new ApiResponse(
          200,
          user[0].watchHistory,
          "Watch history fetched successfully"
      )
  )


})















export { registerUser, loginUser, logoutUser, refreshAccessToken,changeCurrentPassword,getCurrentUser,updateAccountDetails,updateUserAvatar,updateUserCoverImage,getUserChannelProfile,getWatchHistory };

// Why send access token and refresh token?
// If the user refreshes the page or closes the browser, the access token will expire and the user will be logged out.
// By storing the refresh token in cookies, we can generate a new access token when the user refreshes the page or reopens the browser.
// This allows us to automatically log in the user after they refresh the page.
