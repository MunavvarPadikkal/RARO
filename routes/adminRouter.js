const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const adminAuth = require("../middlewares/adminAuth");



router.get("/pageError", adminController.pageError);
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/", adminAuth.isLogin,adminController.loadDashboard);
router.get("/dashboard", adminAuth.isLogin,adminController.loadDashboard);
router.get("/logout",adminController.logout);






module.exports = router;