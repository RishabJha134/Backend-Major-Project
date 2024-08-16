import { Router } from "express";
import { registerUser } from "../controllers/user.controller.js";
import { upload } from "./../middlewares/multer.middleware.js";

const router = Router();

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);

export default router;

// Multer middleware is used to handle file uploads. In this case, it's configured to accept only one avatar and one cover image per user so we use upload.fields.
