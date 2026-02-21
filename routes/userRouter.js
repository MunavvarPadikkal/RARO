const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");


router.get("/pageNotFound",userController.pageNotFound);
router.get("/",userController.loadHomepage)
router.get("/signin",userController.loadSignin);
router.post('/register',userController.register)






module.exports = router;