const User = require("../../models/userSchema");

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

const register = async (req,res) => {
    const {name,email,password} = req.body;
    try {
        const newUser = new User({name,email,password});
        console.log(newUser);
        

        await newUser.save();
        return res.redirect("/signin")
    } catch (error) {
        console.log("Error for save user",error);
        res.status(500).send("Internal Server Error");
    }
}

module.exports = {
    loadHomepage, pageNotFound, loadSignin, register
}