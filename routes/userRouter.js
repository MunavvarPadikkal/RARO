const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const profileController = require("../controllers/user/profileController");
const passport = require("passport");
const userAuth = require("../middlewares/userAuth");
const upload = require("../middlewares/multer");

router.get("/pageNotFound", userController.pageNotFound);
router.get("/", userController.loadHomepage)
router.get("/signin", userAuth.isSignin, userController.loadSignin);
router.get("/register", userController.loadRegister);
router.post('/register', userController.register);
router.post('/verify-otp', userController.verifyOtp);
router.post('/resend-otp', userController.resendOtp);
router.post('/signin', userController.signin);
router.get("/logout", userController.logout);
router.get("/profile", userAuth.checkSession, profileController.loadProfile);


router.post("/updateProfilePhoto", userAuth.checkSession, upload.single("profilePhoto"), profileController.updateProfilePhoto);
router.post("/updateProfile", userAuth.checkSession, profileController.updateProfile);
router.get("/edit-profile", userAuth.checkSession, profileController.loadEditProfile);


// Forgot Password Flow
router.get("/forgotPassword", userController.forgotPasswordLoad);
router.post("/forgotPassword", userController.forgotPasswordSendOtp);
router.get("/verifyForgotPasswordOtp", userController.forgotPasswordOtpLoad);
router.post("/verifyForgotPasswordOtp", userController.forgotPasswordOtpVerify);
router.post("/resendForgotPasswordOtp", userController.forgotPasswordResendOtp);
router.get("/resetPassword", userController.resetPasswordLoad);
router.post("/resetPassword", userController.resetPasswordUpdate);



// Google Login
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google Callback
router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/signin",
    failureMessage: true, // VERY IMPORTANT
  }),
  (req, res) => {
    res.redirect("/");
  }
);


module.exports = router; 