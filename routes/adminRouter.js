const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const adminAuth = require("../middlewares/adminAuth");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");


router.get("/pageError", adminController.pageError);
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/", adminAuth.isLogin,adminController.loadDashboard);
router.get("/dashboard", adminAuth.isLogin,adminController.loadDashboard);
router.get("/logout",adminController.logout);


router.get("/customers",adminAuth.isLogin,customerController.customerInfo);

router.get("/blockCustomer",adminAuth.isLogin,customerController.customerBlocked);
router.get("/unblockCustomer",adminAuth.isLogin,customerController.customerunBlocked);


// Category Management
router.get("/categories", adminAuth.isLogin, categoryController.categoryInfo);
router.post("/addCategory", adminAuth.isLogin, categoryController.addCategory);
router.get("/listCategory", adminAuth.isLogin, categoryController.listCategory);
router.get("/unlistCategory", adminAuth.isLogin, categoryController.unlistCategory);
router.get("/editCategory", adminAuth.isLogin, categoryController.getEditCategory);
router.post("/editCategory", adminAuth.isLogin, categoryController.editCategory);
router.post("/addCategoryOffer", adminAuth.isLogin, categoryController.addOffer);
router.post("/removeCategoryOffer", adminAuth.isLogin, categoryController.removeOffer);


module.exports = router;