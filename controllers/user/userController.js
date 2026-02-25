const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const env = require("dotenv");
env.config();


const pageNotFound = async(req, res)=>{
    try {
        res.render("pageNotFound")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}


const loadHomepage = async (req,res)=>{
    try{
         
        res.render("home");

    }catch (error){
        console.log("Home page not found");
        res.status(500).send("server error");
    }
}

const loadSignin = async (req,res)=>{
    try {
        return res.render("signin")
    } catch (error) {
        console.log("Home page not found");
        res.status(500).send("server error");
    }
}

const loadOtp = async(req, res)=>{
    try {
        res.render("otp")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

function generateOtp(){
    return Math.floor(1000 + Math.random()*9000).toString();
}

async function sendVerificationEmail(email,otp){
    try{
        const transporter = nodemailer.createTransport({
            service:'gmail',
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        })

        const info = await WebTransportError.sendmail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject:"verify your account",
            text:`Your RARO OTP: ${otp}`,
            html:`<b>Your OTP: ${otp}</b>`
        })

        return info.accepted.length>0

    }catch(error){
        console.log("Error sending email")
        return false;
    }
}


const register = async (req,res) => {
    
    try {
      const {name,email,password,confirmpassword} = req.body;
      if(password!==confirmpassword){
        return res.render("signin",{message:"Password do not match"});
      }

      const findUser = await User.findOne({email});
      if(finduser){
        return res.render("signin",{message:"User with this email already exists"});
      }

      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email,otp);
      if(!emailSent){
        return res.json("email-error");
      }

      req.session.userOtp = otp;
      req.session.userData = {name,email,password};
    //   res.render("verify-otp");
      console.log("OTP Sent ",otp);

    } catch (error) {
        console.log("User Register Error");
        res.redirect("/pageNotFound")
    }
}

module.exports = {
    loadHomepage,
    pageNotFound,
    loadSignin,
    register,
    loadOtp 
}