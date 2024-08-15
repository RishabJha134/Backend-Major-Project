import multer from "multer";

const storage = multer.diskStorage({

    // kaha pe store karana hai:-
  destination: function (req, file, cb) {
    cb(null, "./public/temp");
  },

  // kis filename se store karana hai:-
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

export const upload = multer({
  storage,
});



