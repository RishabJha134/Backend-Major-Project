import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Configuration
cloudinary.config({
  cloud_name: "debffb5tk",
  api_key: "767839345551917",
  api_secret: "8Nm-65hsrASsxGIC4fyicX4yCJI",
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
    fs.unlinkSync(localPath); // images upload hojayegi fir bhi apne local path se delete kardo aur upload nahi ho paayegi fir bhi delete karna hai.

    return response;
  } catch (err) {
    // agar koi error aa jata hai toh jo humne apne local server/ saved temporary pr jo file upload kari hai usko unlink/delete kardete hai.
    fs.unlinkSync(localPath);
    return null;
  }
};

export { uploadOnCloudinary };
