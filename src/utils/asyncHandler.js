// Original asyncHandler function using Promise.resolve
// const asyncHandler = (requestHandler) => {
//   (req, res, next) => {
//     Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
//   };
// };

function asyncHandler(requestHandler) {
  return async function (req, res, next) {
    try {
      await requestHandler(req, res, next);
    } catch (err) {
      
      console.log(err); // Passes the error to the next middleware (like an error-handling middleware)
    }
  };
}

export { asyncHandler };
