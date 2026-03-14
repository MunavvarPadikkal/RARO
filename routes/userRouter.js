const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const passport = require("passport");
const userAuth = require("../middlewares/userAuth");

router.get("/pageNotFound",userController.pageNotFound);
router.get("/",userController.loadHomepage)
router.get("/signin",userAuth.isSignin,userController.loadSignin);
router.get("/register",userController.loadRegister);
router.post('/register',userController.register);
router.post('/verify-otp',userController.verifyOtp);
router.post('/resend-otp',userController.resendOtp);
router.post('/signin',userController.signin);
router.get("/logout", userController.logout);
router.get("/profile",userController.loadProfile);

// Admin UI preview (UI only — no backend logic)
router.get("/admin-ui", (req, res) =>
  res.redirect("/admin-ui/dashboard")
);
router.get("/admin-ui/dashboard", (req, res) =>
  res.render("dashboard", { pageTitle: "Dashboard", active: "dashboard" })
);
router.get("/admin-ui/customers", (req, res) =>
  res.render("customers", { pageTitle: "Customers", active: "customers" })
);
router.get("/admin-ui/products", (req, res) =>
  res.render("products", { pageTitle: "Products", active: "products" })
);
router.get("/admin-ui/orders", (req, res) =>
  res.render("orders", { pageTitle: "Orders", active: "orders" })
);
router.get("/admin-ui/categories", (req, res) =>
  res.render("categories", { pageTitle: "Categories", active: "categories" })
);
router.get("/admin-ui/return-requests", (req, res) =>
  res.render("returns", { pageTitle: "Return Requests", active: "returns" })
);
router.get("/admin-ui/sales-report", (req, res) =>
  res.render("sales-report", { pageTitle: "Sales Report", active: "sales" })
);
router.get("/admin-ui/coupons", (req, res) =>
  res.render("coupons", { pageTitle: "Coupons", active: "coupons" })
);
router.get("/admin-ui/banners", (req, res) =>
  res.render("banners", { pageTitle: "Banners", active: "banners" })
);

// Google Login
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google Callback
router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    successRedirect: "/",
    failureRedirect: "/signin",
  })
);




module.exports = router;