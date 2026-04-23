const User = require("../models/userSchema");

const checkSession = async (req,res,next)=>{
      try {
        if (!req.session.user) {
            if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
                return res.status(401).json({ success: false, message: "Please login to proceed" });
            }
            return res.redirect("/signin");
        }

        const user = await User.findById(req.session.user);

        // user deleted OR blocked
        if (!user || user.isBlocked) {
            req.session.destroy();
            return res.redirect("/signin");
        }

        next();
    } catch (error) {
        console.log(error);
        return res.redirect("/signin");
    }
}

const isSignin = (req,res,next)=>{
    if(req.session.user){
        res.redirect('/')
    }else{
        next();
    }
}

const checkBlockedStatus = async (req, res, next) => {
    try {
        if (!req.session.user) {
            return next(); // Guest user, allow access
        }

        const user = await User.findById(req.session.user);

        // user deleted OR blocked
        if (!user || user.isBlocked) {
            req.session.destroy();
            return res.redirect("/signin");
        }

        next(); // Logged in and not blocked, allow access
    } catch (error) {
        console.log(error);
        return next();
    }
}

module.exports = {checkSession, isSignin, checkBlockedStatus}