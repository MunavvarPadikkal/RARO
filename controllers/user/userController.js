const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const env = require("dotenv");
env.config();
const bcrypt = require("bcrypt");
const { json } = require("express");


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
        if (user) {
            const userData = await User.findOne({ _id: user._id });
            res.render("home", { user: userData });
        } else {
            res.render("home");
        }


    } catch (error) {
        console.log("Home page not found");
        res.status(500).send("server error");
    }
}

const loadSignin = async (req, res) => {
    try {
        return res.render("signin", {
            signinMessage: "",
            registerMessage: "",
            activeTab: "login"
        });
    } catch (error) {
        console.log("Home page not found");
        res.status(500).send("server error");
    }
}

const loadRegister = async (req, res) => {
    try {
        return res.render("register", {
            signinMessage: "",
            registerMessage: ""
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

function generateOtp() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        })

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "verify your account",
            text: `Your RARO OTP: ${otp}`,
            html: `<b>Your RARO OTP: ${otp}</b>`
        })

        return info.accepted.length > 0

    } catch (error) {
        console.log("Error sending email")
        return false;
    }
}


const register = async (req, res) => {

    try {
        const { name, email, password, confirmpassword } = req.body;
        if (password !== confirmpassword) {
            return res.render("register", { registerMessage: "Password do not match", signinMessage: "" });
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render("register", { registerMessage: "User with this email already exists", signinMessage: "" });
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.json("email-error");
        }

        req.session.userOtp = otp;
        req.session.userOtpExpire = Date.now() + 60 * 1000;
        req.session.userData = { name, email, password };
        res.render("otp");
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

            const saveUserData = new User({
                name: user.name,
                email: user.email,
                password: passwordHash,
            })
            await saveUserData.save();

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

        const findUser = await User.findOne({
            isAdmin: 0,
            email: signinEmail,
        });

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
        res.redirect("/");
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
        const findUser = await User.findOne({ email: email });
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
        await User.updateOne({ email: email }, { $set: { password: passwordHash } });
        req.session.forgotPasswordEmail = null; // clear the session var
        res.redirect("/signin");
    } catch (error) {
        console.error(error);
        res.redirect("/pageNotFound");
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
    resetPasswordUpdate
}
