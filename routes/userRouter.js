const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const profileController = require("../controllers/user/profileController");
const cartController = require("../controllers/user/cartController");
const checkoutController = require("../controllers/user/checkoutController");
const orderController = require("../controllers/user/orderController");
const wishlistController = require("../controllers/user/wishlistController");
const couponController = require("../controllers/user/couponController");
const passport = require("passport");
const userAuth = require("../middlewares/userAuth");
const { upload } = require("../middlewares/multer");

router.get("/pageNotFound", userController.pageNotFound);
router.get("/", userAuth.checkBlockedStatus,userController.loadHomepage)
router.get("/about", userController.loadAboutPage);
router.get("/contact", userController.loadContactPage);


router.get("/signin", userAuth.isSignin, userController.loadSignin);
router.get("/register", userAuth.isSignin, userController.loadRegister);
router.post('/register', userController.register);
router.get('/verify-otp', userAuth.isSignin, userController.loadOtp);
router.post('/verify-otp', userController.verifyOtp);
router.post('/resend-otp', userController.resendOtp);
router.post('/signin', userController.signin);
router.get("/logout", userController.logout);
router.get("/profile", userAuth.checkSession, profileController.loadProfile);
router.get("/wallet", userAuth.checkSession, profileController.loadWallet);
router.get("/referrals", userAuth.checkSession, profileController.loadReferrals);
router.get("/shop", userController.loadShopPage);
router.get("/product/:id", userController.loadProductDetails);
router.post("/product/:id/review", userAuth.checkSession, userController.submitReview);

// Forgot Password Flow
router.get("/forgotPassword", userController.forgotPasswordLoad);
router.post("/forgotPassword", userController.forgotPasswordSendOtp);
router.get("/verifyForgotPasswordOtp", userController.forgotPasswordOtpLoad);
router.post("/verifyForgotPasswordOtp", userController.forgotPasswordOtpVerify);
router.post("/resendForgotPasswordOtp", userController.forgotPasswordResendOtp);
router.get("/resetPassword", userController.resetPasswordLoad);
router.post("/resetPassword", userController.resetPasswordUpdate);

// Profile Management
router.post("/updateProfilePhoto", userAuth.checkSession, upload.single("profilePhoto"), profileController.updateProfilePhoto);
router.post("/updateProfile", userAuth.checkSession, profileController.updateProfile);
router.get("/edit-profile", userAuth.checkSession, profileController.loadEditProfile);
// Change Email with OTP
router.post("/change-email/request", userAuth.checkSession, profileController.changeEmailRequest);
router.post("/change-email/verify-otp", userAuth.checkSession, profileController.changeEmailVerifyOtp);
router.post("/change-email/resend-otp", userAuth.checkSession, profileController.changeEmailResendOtp);

// Address Management
router.get("/address", userAuth.checkSession, profileController.loadAddress); 
router.post("/addAddress", userAuth.checkSession, profileController.addAddress);
router.post("/editAddress", userAuth.checkSession, profileController.editAddress);
router.delete("/deleteAddress", userAuth.checkSession, profileController.deleteAddress);
router.post("/setDefaultAddress", userAuth.checkSession, profileController.setDefaultAddress);

// Cart Management
router.get("/cart", userAuth.checkSession, cartController.loadCart);
router.post("/cart/add", userAuth.checkSession, cartController.addToCart);
router.patch("/cart/update-quantity", userAuth.checkSession, cartController.updateQuantity);
router.delete("/cart/remove", userAuth.checkSession, cartController.removeFromCart);
router.post("/cart/apply-coupon", userAuth.checkSession, couponController.applyCoupon);
router.post("/cart/remove-coupon", userAuth.checkSession, couponController.removeCoupon);

// Checkout
router.get("/checkout", userAuth.checkSession, checkoutController.loadCheckout);
router.post("/checkout/create-razorpay-order", userAuth.checkSession, checkoutController.createRazorpayOrder);
router.post("/checkout/place-order", userAuth.checkSession, checkoutController.placeOrder);
router.get("/payment-failed/:orderId", userAuth.checkSession, checkoutController.paymentFailed);
router.post("/checkout/retry-payment/:orderId", userAuth.checkSession, checkoutController.retryPayment);
router.post("/checkout/verify-retry", userAuth.checkSession, checkoutController.verifyRetryPayment);
router.get("/order-success/:orderId", userAuth.checkSession, checkoutController.orderSuccess);

// Dynamic Order Management
router.get("/orders", userAuth.checkSession, orderController.loadOrders);
router.get("/orders/:orderId", userAuth.checkSession, orderController.loadOrderDetail);
router.post("/orders/:orderId/cancel", userAuth.checkSession, orderController.cancelOrder);
router.post("/orders/:orderId/items/:itemId/cancel", userAuth.checkSession, orderController.cancelOrderItem);
router.post("/orders/:orderId/return", userAuth.checkSession, orderController.requestReturn);
router.post("/orders/:orderId/items/:itemId/return", userAuth.checkSession, orderController.requestItemReturn);
router.get("/orders/:orderId/invoice", userAuth.checkSession, orderController.downloadInvoice);

// Wishlist Management
router.get("/wishlist", userAuth.checkSession, wishlistController.loadWishlist);
router.post("/wishlist/add", wishlistController.addToWishlist); // User auth validated inside explicitly for guest warning support
router.delete("/wishlist/remove", userAuth.checkSession, wishlistController.removeFromWishlist);



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