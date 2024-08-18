import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken"

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    avatar: {
      type: String, // cloudinary url
      required: true,
    },
    coverImage: {
      type: String, // cloudinary url
    },
    watchHistory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Video",
      },
    ],
    password: {
      type: String,
      required: [true, "password is required"],
    },
    refreshToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// step1:- hashing the password just before saving;

// database me save karne se pehle ye function pre wala pehle chalega:-
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, 11);
  next();
});

// step2:- comparing the hashed password with the entered password:-
// custom methods:-

userSchema.methods.isPasswordCorrect = async function (password) {
  // syntax:- bcrypt.compare(user input plain password, db saved hashed password).
  return await bcrypt.compare(password, this.password);
};

// step3:- generating a token for user on successful login:-

// access token:-
// Access token
userSchema.methods.generateAccessToken = async function () {
  try {
    const token = await jwt.sign(
      {
        _id: this._id,
        email: this.email,
        username: this.username,
        fullName: this.fullName,
      },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY, // default to 15 minutes if not set
      }
    );
    return token;
  } catch (error) {
    throw new Error(`Error generating access token: ${error.message}`);
  }
};

// Refresh token
userSchema.methods.generateRefreshToken = async function () {
  try {
    const token = await jwt.sign(
      { _id: this._id },
      process.env.REFRESH_TOKEN_SECRET,
      {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRY, // default to 7 days if not set
      }
    );
    return token;
  } catch (error) {
    throw new Error(`Error generating refresh token: ${error.message}`);
  }
};



export const User = mongoose.model("User", userSchema);
