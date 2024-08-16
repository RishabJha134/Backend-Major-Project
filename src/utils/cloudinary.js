import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localPath) => {
  try {
    if (!localPath) {
      return null;
    }
    // upload file on cloudinary:-
    const response = await cloudinary.uploader.upload(localPath, {
      resource_type: "auto",
    });
    // file has been successfully uploaded:-
    console.log("file successfully uploaded on cloudinary" + response.url);
    return response;
  } catch (err) {
    // agar koi error aa jata hai toh jo humne apne local server/ saved temporary pr jo file upload kari hai usko unlink/delete kardete hai.
    fs.unlinkSync(localPath);
    return null;
  }
};

export { uploadOnCloudinary };
