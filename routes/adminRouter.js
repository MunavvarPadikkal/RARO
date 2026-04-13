const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const adminAuth = require("../middlewares/adminAuth");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const productController = require("../controllers/admin/productController");
const { productUpload } = require("../middlewares/multer");


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


// Product Management
router.get("/products", adminAuth.isLogin, productController.getProducts);
router.get("/addProduct", adminAuth.isLogin, productController.getAddProduct);
router.post("/addProduct", adminAuth.isLogin, productUpload.array("productImages", 4), productController.addProduct);
router.get("/editProduct", adminAuth.isLogin, productController.getEditProduct);
router.post("/editProduct", adminAuth.isLogin, productUpload.array("productImages", 4), productController.editProduct);
router.post("/deleteProduct", adminAuth.isLogin, productController.deleteProduct);
router.post("/restoreProduct", adminAuth.isLogin, productController.restoreProduct);
router.post("/blockProduct", adminAuth.isLogin, productController.blockProduct);
router.post("/unblockProduct", adminAuth.isLogin, productController.unblockProduct);
router.post("/deleteProductImage", adminAuth.isLogin, productController.deleteProductImage);


module.exports = router;