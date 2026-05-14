const User = require("../models/userSchema");


const isLogin = (req,res,next)=>{
    if(req.session.admin){
        User.findOne({isAdmin:true})
        .then(data=>{
            if(data){
                next();
            }else{
                if (req.headers.accept && req.headers.accept.includes('application/json')) {
                    return res.status(401).json({ error: "Unauthorized. Please login again." });
                }
                res.redirect("/admin/login");
            }
        })
        .catch(error=>{
            console.log("error in admin auth middleware", error);
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return res.status(500).json({ error: "Internal server error during authentication" });
            }
            res.status(500).send("Internal server error");
        })
    } else {
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.status(401).json({ error: "Session expired. Please login again." });
        }
        res.redirect("/admin/login");
    }
}


module.exports = {isLogin}