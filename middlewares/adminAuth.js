const User = require("../models/userSchema");


const isLogin = (req,res,next)=>{
    if(req.session.admin){
        User.findOne({isAdmin:true})
        .then(data=>{
            if(data){
                next();
            }else{
                res.redirect("/admin/login");
            }
        })
        .catch(error=>{
            console.log("error in admin auth middleware", error);
            res.status(500).send("Internal server error");
        })
    } else {
        res.redirect("/admin/login");
    }
}


module.exports = {isLogin}