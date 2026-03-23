const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const adminAuth = require("../middlewares/adminAuth");
const customerController = require("../controllers/admin/customerController");


router.get("/pageError", adminController.pageError);
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/", adminAuth.isLogin,adminController.loadDashboard);
router.get("/dashboard", adminAuth.isLogin,adminController.loadDashboard);
router.get("/logout",adminController.logout);


router.get("/customers",adminAuth.isLogin,customerController.customerInfo);

router.get("/blockCustomer",adminAuth.isLogin,customerController.customerBlocked);
router.get("/unblockCustomer",adminAuth.isLogin,customerController.customerunBlocked);



module.exports = router;