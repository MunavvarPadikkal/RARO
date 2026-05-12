const userService = require("../../services/userService");
const bcrypt = require("bcrypt");
const { generateOtp, sendVerificationEmail } = require("../../utils/emailUtils");
const productService = require("../../services/productService");
const categoryService = require("../../services/categoryService");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Review = require("../../models/reviewSchema");
const referralService = require("../../services/referralService");
const Banner = require("../../models/bannerSchema");
const wishlistService = require("../../services/wishlistService");


const pageNotFound = async (req, res) => {
    try {
        res.render("pageNotFound")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}


const loadHomepage = async (req, res) => {
    try {
        const user = req.session.user;
        
        // Fetch all listed categories
        const categories = await Category.find({ isListed: true });
        
        // Identify specific categories for tabs (Men, Customized, Oversized, Minimal)
        const menCategory = categories.find(c => c.name.match(/men/i));
        const customizedCategory = categories.find(c => c.name.match(/customized/i));
        const oversizedCategory = categories.find(c => c.name.match(/oversized/i));
        const minimalCategory = categories.find(c => c.name.match(/minimal/i));

        // Fetch products for "All" tab (Newest 8)
        const allProducts = await Product.find({ isBlocked: false, isDeleted: false })
            .populate('category')
            .sort({ createdAt: -1 })
            .limit(8);

        // Fetch products for "Men" tab (Newest 4)
        const menProducts = menCategory 
            ? await Product.find({ category: menCategory._id, isBlocked: false, isDeleted: false }).sort({ createdAt: -1 }).limit(4)
            : [];

        // Fetch products for "Customized" tab (Newest 4)
        const customizedProducts = customizedCategory 
            ? await Product.find({ category: customizedCategory._id, isBlocked: false, isDeleted: false }).sort({ createdAt: -1 }).limit(4)
            : [];

        // Fetch products for "Oversized" tab (Newest 4)
        const oversizedProducts = oversizedCategory 
            ? await Product.find({ category: oversizedCategory._id, isBlocked: false, isDeleted: false }).sort({ createdAt: -1 }).limit(4)
            : [];

        // Fetch products for "Minimal" tab (Newest 4)
        const minimalProducts = minimalCategory 
            ? await Product.find({ category: minimalCategory._id, isBlocked: false, isDeleted: false }).sort({ createdAt: -1 }).limit(4)
            : [];

        // Fetch active banners for the carousel
        const now = new Date();
        const banners = await Banner.find({
            isActive: true,
            isDeleted: false,
            $or: [
                { startDate: null },
                { startDate: { $lte: now } }
            ]
        }).sort({ priority: 1 }).lean();

        // Filter out expired banners (expiryDate check)
        const activeBanners = banners.filter(b => {
            if (!b.expiryDate) return true;
            return new Date(b.expiryDate) >= now;
        });

        const userData = user ? await userService.findUserById(user._id) : null;
        const wishlistProductIds = user ? await wishlistService.getWishlistProductIds(user._id) : [];

        res.render("home", { 
            user: userData, 
            products: allProducts, 
            menProducts, 
            customizedProducts, 
            oversizedProducts,
            minimalProducts,
            categories,
            menCategory,
            customizedCategory,
            oversizedCategory,
            minimalCategory,
            banners: activeBanners,
            wishlistProductIds
        });

    } catch (error) {
        console.log("Home page error:", error);
        res.status(500).send("server error");
    }
}

const loadSignin = (req, res) => {
  let message = "";

  if (req.session.messages) {
    message = req.session.messages[0];
    req.session.messages = []; // clear after showing
  }

  res.render("signin", {
    signinMessage: message,
    registerMessage: "",
    activeTab: "login",
  });
};


const loadRegister = async (req, res) => {
    try {
        return res.render("register", {
            signinMessage: "",
            registerMessage: "",
            referralCode: req.query.ref || ""
        });
    } catch (error) {
        console.log("Home page not found");
        res.status(500).send("server error");
    }
}

const loadOtp = async (req, res) => {
    try {
        res.render("otp")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}




const register = async (req, res) => {

    try {
        const { name, email, password, confirmpassword, referralCode } = req.body;
        
        // Validation
        const nameRegex = /^[A-Za-z\s]+$/;
        if (!name || name.trim().length < 3) {
            return res.render("register", { registerMessage: "Name must be at least 3 characters long", signinMessage: "", referralCode: referralCode || "" });
        }
        if (!nameRegex.test(name)) {
            return res.render("register", { registerMessage: "Name can only contain letters and spaces", signinMessage: "", referralCode: referralCode || "" });
        }

        if(password!==confirmpassword){
        return res.render("register",{registerMessage:"Passwords do not match",signinMessage:"", referralCode: referralCode || ""});
      }

      if (password.length < 8) {
        return res.render("register", {registerMessage: "Password must be at least 8 characters", signinMessage:"", referralCode: referralCode || ""});
      }
      if (!/[A-Z]/.test(password)) {
        return res.render("register", {registerMessage: "Password must contain an uppercase letter", signinMessage:"", referralCode: referralCode || ""});
      }
      if (!/[a-z]/.test(password)) {
        return res.render("register", {registerMessage: "Password must contain a lowercase letter", signinMessage:"", referralCode: referralCode || ""});
      }
      if (!/\d/.test(password)) {
        return res.render("register", {registerMessage: "Password must contain a number", signinMessage:"", referralCode: referralCode || ""});
      }
      if (!/[@$!%*?&]/.test(password)) {
        return res.render("register", {registerMessage: "Password must contain a special character (e.g. @$!%*?&)", signinMessage:"", referralCode: referralCode || ""});
      }

        const findUser = await userService.findUserByEmail(email);
        if (findUser) {
            return res.render("register", { registerMessage: "User with this email already exists", signinMessage: "", referralCode: referralCode || "" });
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.json("email-error");
        }

        req.session.userOtp = otp;
        req.session.userOtpExpire = Date.now() + 60 * 1000;
        req.session.userData = { name, email, password, referralCode: referralCode || null };
        res.redirect("/verify-otp");
        console.log("OTP Sent ", otp);

    } catch (error) {
        console.log("User Register Error");
        res.redirect("/pageNotFound")
    }
}

const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        return passwordHash;


    } catch (error) {

    }
}

const verifyOtp = async (req, res) => {
    try {
        console.log(req.body);
        const { otp } = req.body;
        console.log(otp);

        if (!req.session.userOtp || !req.session.userOtpExpire || Date.now() > req.session.userOtpExpire) {
            return res.status(400).json({
                success: false,
                message: "OTP expired. Please request a new one."
            });
        }

        if (otp === req.session.userOtp) {
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);

            // Generate a unique referral code for the new user
            const newUserReferralCode = await referralService.generateReferralCode(user.name);

            const saveUserData = await userService.createUser({
                name: user.name,
                email: user.email,
                password: passwordHash,
                referralCode: newUserReferralCode,
            });

            // If a referral code was provided during signup, create a pending referral
            if (user.referralCode) {
                try {
                    await referralService.createReferral(user.referralCode, saveUserData._id);
                    console.log(`Referral created: ${user.referralCode} -> ${saveUserData._id}`);
                } catch (refError) {
                    // Log but don't block signup if referral fails
                    console.error("Referral creation failed (non-blocking):", refError.message);
                }
            }

            // Set session user same as normal signin
            req.session.user = {
                _id: saveUserData._id,
                name: saveUserData.name,
                email: saveUserData.email
            };

            // Clear OTP data after successful verification
            req.session.userOtp = null;
            req.session.userOtpExpire = null;
            req.session.userData = null;
            res.json({ success: true, redirectUrl: "/" });
        } else {
            res.status(400).json({ success: false, message: "Invalid OTP, Please try again" })
        }

    } catch (error) {
        console.error("Error verifying OTP", error);
        res.status(500).json({ success: false, message: "An error occured" })
    }
}

const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session" });
        }

        const otp = generateOtp();
        req.session.userOtp = otp;
        req.session.userOtpExpire = Date.now() + 60 * 1000;

        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log("resend OTP =", otp);
            res.status(200).json({ success: true, message: "OTP Resend successfully" })
        } else {
            res.status(500).json({ success: false, message: "Failed to resend OTP, Please try again" });
        }

    } catch (error) {
        console.error("Error resending OTP");
        res.status(500).json({ status: false, message: "Internal server error, Please try again" });

    }
}


const signin = async (req, res) => {
    try {
        const { signinEmail, signinPassword } = req.body;
        console.log(req.body);

        const findUser = await userService.findCustomerByEmail(signinEmail);

        if (!findUser) {
            return res.render("signin", { signinMessage: "User not found", registerMessage: "", activeTab: "login" });
        }

        if (findUser.isBlocked) {
            return res.render("signin", {
                signinMessage: "User is blocked by admin", registerMessage: "", activeTab: "login"
            });
        }

        const passwordMatch = await bcrypt.compare(
            signinPassword,
            findUser.password
        );

        if (!passwordMatch) {
            return res.render("signin", {
                signinMessage: "Incorrect Password", registerMessage: "", activeTab: "login"
            });
        }

        req.session.user = {
            _id: findUser._id,
            name: findUser.name,
            email: findUser.email
        };
        console.log("Login success, redirecting...");
        res.redirect("/");
    } catch (error) {
        console.error("login error", error);
        res.render("signin", {
            signinMessage: "Login failed, Please try again later!",
            registerMessage: "", activeTab: "login"
        });
    }
};


const logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect("/signin");
    });
};




const forgotPasswordLoad = async (req, res) => {
    try {
        res.render("forgot-password", { message: "" });
    } catch (error) {
        console.error(error);
        res.redirect("/pageNotFound");
    }
}

const forgotPasswordSendOtp = async (req, res) => {
    try {
        const { email } = req.body;
        const findUser = await userService.findUserByEmail(email);
        if (!findUser) {
            return res.render("forgot-password", { message: "User with this email does not exist" });
        }
        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            req.session.forgotPasswordOtp = otp;
            req.session.forgotPasswordEmail = email;
            req.session.forgotPasswordOtpExpire = Date.now() + 60 * 1000;
            res.render("forgot-password-otp");
            console.log("Forgot Password OTP Sent ", otp);
        } else {
            res.json({ success: false, message: "Failed to send OTP. Please try again" });
        }
    } catch (error) {
        console.error(error);
        res.redirect("/pageNotFound");
    }
}

const forgotPasswordOtpLoad = async (req, res) => {
    try {
        res.render("forgot-password-otp");
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}

const forgotPasswordOtpVerify = async (req, res) => {
    try {
        const { otp } = req.body;
        if (!req.session.forgotPasswordOtp || !req.session.forgotPasswordOtpExpire || Date.now() > req.session.forgotPasswordOtpExpire) {
            return res.status(400).json({ success: false, message: "OTP expired. Please request a new one." });
        }

        if (otp === req.session.forgotPasswordOtp) {
            req.session.forgotPasswordOtp = null; // clear it
            req.session.forgotPasswordOtpExpire = null;
            res.json({ success: true, redirectUrl: "/resetPassword" });
        } else {
            res.status(400).json({ success: false, message: "Invalid OTP, Please try again" });
        }
    } catch (error) {
        console.error("Error verifying OTP", error);
        res.status(500).json({ success: false, message: "An error occured" });
    }
}

const forgotPasswordResendOtp = async (req, res) => {
    try {
        const email = req.session.forgotPasswordEmail;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session" });
        }

        const otp = generateOtp();
        req.session.forgotPasswordOtp = otp;
        req.session.forgotPasswordOtpExpire = Date.now() + 60 * 1000;

        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log("resend forgot password OTP =", otp);
            res.status(200).json({ success: true, message: "OTP Resend successfully" })
        } else {
            res.status(500).json({ success: false, message: "Failed to resend OTP, Please try again" });
        }
    } catch (error) {
        console.error("Error resending OTP", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

const resetPasswordLoad = async (req, res) => {
    try {
        if (!req.session.forgotPasswordEmail) {
            return res.redirect("/signin");
        }
        res.render("reset-password", { message: "" });
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}

const resetPasswordUpdate = async (req, res) => {
    try {
        const { password, confirmpassword } = req.body;
        const email = req.session.forgotPasswordEmail;
        if (!email) {
            return res.redirect("/signin");
        }

        if (password !== confirmpassword) {
            return res.render("reset-password", { message: "Passwords do not match" });
        }

        const passwordHash = await securePassword(password);
        await userService.updateUserPassword(email, passwordHash);
        req.session.forgotPasswordEmail = null; // clear the session var
        res.redirect("/signin");
    } catch (error) {
        console.error(error);
        res.redirect("/pageNotFound");
    }
}

const loadShopPage = async (req, res) => {
    try {
        let search = req.query.search || "";
        let page = parseInt(req.query.page) || 1;
        let category = req.query.category || "";
        let sort = req.query.sort || "newest";
        const limit = 6;

        let minPrice = req.query.minPrice ? parseInt(req.query.minPrice) : undefined;
        let maxPrice = req.query.maxPrice ? parseInt(req.query.maxPrice) : undefined;
        
        let sizes = req.query.size || [];
        if (typeof sizes === "string" && sizes.trim() !== "") {
            sizes = sizes.split(',');
        } else if (!Array.isArray(sizes)) {
            sizes = [];
        }

        let layout = req.query.layout || "3col";

        const filters = { search, category, sort, page, limit, minPrice, maxPrice, sizes };
        const { data: products, count } = await productService.getShopProducts(filters);
        
        const { data: allCats } = await categoryService.getCategoryInfo("", 1, 100);
        const listedCategories = allCats.filter(c => c.isListed);
        
        const totalPages = Math.ceil(count / limit);
        const wishlistProductIds = req.session.user ? await wishlistService.getWishlistProductIds(req.session.user._id) : [];

        res.render("shop", {
            products,
            categories: listedCategories,
            totalPages,
            currentPage: page,
            search,
            selectedCategory: category,
            selectedSort: sort,
            totalProducts: count,
            selectedSizes: sizes,
            minPrice: minPrice || 0,
            maxPrice: maxPrice || 2000,
            selectedLayout: layout,
            wishlistProductIds
        });

    } catch (error) {
        console.error("Shop page error:", error);
        res.status(500).send("server error");
    }
}

const loadProductDetails = async (req, res) => {
    try {
        const id = req.params.id;
        
        // Fetch Product with category populated
        const product = await Product.findById(id).populate('category').lean();
        
        if (!product || product.isDeleted || !product.category || !product.category.isListed) {
            return res.redirect("/shop");
        }
        
        if (product.isBlocked) {
            return res.redirect("/shop");
        }

        // Fetch related products (same category, different id, limit 4)
        const relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: product._id },
            isBlocked: false,
            isDeleted: false
        }).limit(4).lean();

        // Fetch reviews
        const reviews = await Review.find({ product: product._id }).populate('user', 'name').sort({ createdAt: -1 }).lean();
        
        let avgRating = 0;
        if (reviews.length > 0) {
            const sum = reviews.reduce((acc, rev) => acc + rev.rating, 0);
            avgRating = (sum / reviews.length).toFixed(1);
        }

        res.render("product-details", {
            product,
            relatedProducts,
            reviews,
            avgRating,
            user: req.session.user // Pass user explicitly for the view
        });

    } catch (error) {
        console.error("Error loading product details:", error);
        res.redirect("/pageNotFound");
    }
}

const submitReview = async (req, res) => {
    try {
        const productId = req.params.id;
        const { rating, comment } = req.body;
        const userId = req.session.user._id;

        if (!rating || !comment) {
            return res.redirect(`/product/${productId}`);
        }

        const newReview = new Review({
            product: productId,
            user: userId,
            rating: parseInt(rating),
            comment: comment.trim()
        });

        await newReview.save();
        res.redirect(`/product/${productId}`);

    } catch (error) {
        console.error("Error submitting review:", error);
        res.redirect(`/product/${req.params.id}`);
    }
}

// const cartCount = async (req, res)
// =>{
//     try {
//         const count = await User.find({cart}).countdocuments();

//     }
// }

const loadAboutPage = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = user ? await userService.findUserById(user._id) : null;
        res.render("about", { user: userData });
    } catch (error) {
        console.error("About page error:", error);
        res.status(500).send("server error");
    }
}

const loadContactPage = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = user ? await userService.findUserById(user._id) : null;
        res.render("contact", { user: userData });
    } catch (error) {
        console.error("Contact page error:", error);
        res.status(500).send("server error");
    }
}

module.exports = {


    loadHomepage,
    pageNotFound,
    loadSignin,
    loadRegister,
    register,
    loadOtp,
    verifyOtp,
    resendOtp,
    signin,
    logout,
    forgotPasswordLoad,
    forgotPasswordSendOtp,
    forgotPasswordOtpLoad,
    forgotPasswordOtpVerify,
    forgotPasswordResendOtp,
    resetPasswordLoad,
    resetPasswordUpdate,
    loadShopPage,
    loadProductDetails,
    submitReview,
    loadAboutPage,
    loadContactPage
};


