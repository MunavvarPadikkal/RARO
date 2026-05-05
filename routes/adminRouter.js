const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const adminAuth = require("../middlewares/adminAuth");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const productController = require("../controllers/admin/productController");
const adminOrderController = require("../controllers/admin/adminOrderController");
const couponController = require("../controllers/admin/couponController");
const offerController = require("../controllers/admin/offerController");
const { productUpload } = require("../middlewares/multer");


router.get("/pageError", adminController.pageError);
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/", adminAuth.isLogin, adminController.loadDashboard);
router.get("/dashboard", adminAuth.isLogin, adminController.loadDashboard);
router.get("/dashboard/chart-data", adminAuth.isLogin, adminController.getChartData);
router.get("/logout", adminController.logout);

// Sales Report
const salesReportController = require("../controllers/admin/salesReportController");
router.get("/sales-report", adminAuth.isLogin, salesReportController.loadSalesReport);
router.get("/sales-report/download/pdf", adminAuth.isLogin, salesReportController.downloadPdf);
router.get("/sales-report/download/excel", adminAuth.isLogin, salesReportController.downloadExcel);


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

// Order Management
router.get("/orders", adminAuth.isLogin, adminOrderController.loadOrders);
router.get("/orders/:orderId", adminAuth.isLogin, adminOrderController.loadOrderDetail);
router.post("/orders/:orderId/status", adminAuth.isLogin, adminOrderController.updateOrderStatus);

// Return Management
router.get("/return-requests", adminAuth.isLogin, adminOrderController.loadReturnRequests);
router.post("/returns/:orderId/approve", adminAuth.isLogin, adminOrderController.approveReturn);
router.post("/returns/:orderId/reject", adminAuth.isLogin, adminOrderController.rejectReturn);
router.post("/returns/:orderId/items/:itemId/approve", adminAuth.isLogin, adminOrderController.approveItemReturn);
router.post("/returns/:orderId/items/:itemId/reject", adminAuth.isLogin, adminOrderController.rejectItemReturn);
router.post("/returns/:orderId/items/:itemId/complete", adminAuth.isLogin, adminOrderController.completeItemReturn);

// Inventory / Stock Management
router.get("/inventory", adminAuth.isLogin, adminOrderController.loadInventory);
router.post("/inventory/update-stock", adminAuth.isLogin, adminOrderController.updateStock);


// Coupon Management
router.get("/coupons", adminAuth.isLogin, couponController.loadCoupons);
router.get("/addCoupon", adminAuth.isLogin, couponController.getAddCoupon);
router.post("/addCoupon", adminAuth.isLogin, couponController.addCoupon);
router.get("/editCoupon", adminAuth.isLogin, couponController.getEditCoupon);
router.post("/editCoupon", adminAuth.isLogin, couponController.editCoupon);
router.post("/toggleCouponStatus", adminAuth.isLogin, couponController.toggleStatus);
router.post("/deleteCoupon", adminAuth.isLogin, couponController.deleteCoupon);

// Offer Management
router.get("/offers", adminAuth.isLogin, offerController.loadOffers);
router.get("/addOffer", adminAuth.isLogin, offerController.loadAddOffer);
router.post("/addOffer", adminAuth.isLogin, offerController.addOffer);
router.get("/editOffer/:id", adminAuth.isLogin, offerController.loadEditOffer);
router.post("/editOffer/:id", adminAuth.isLogin, offerController.editOffer);
router.post("/offers/toggle/:id", adminAuth.isLogin, offerController.toggleOfferStatus);
router.post("/offers/delete/:id", adminAuth.isLogin, offerController.deleteOffer);

// Refund Management
router.get("/refunds", adminAuth.isLogin, adminController.loadRefunds);
router.post("/refunds/:refundId/approve", adminAuth.isLogin, adminController.approveRefund);

// Referral Management
const referralController = require("../controllers/admin/referralController");
router.get("/referrals", adminAuth.isLogin, referralController.loadReferrals);
router.get("/referral-settings", adminAuth.isLogin, referralController.loadSettings);
router.post("/referral-settings", adminAuth.isLogin, referralController.updateSettings);

module.exports = router;