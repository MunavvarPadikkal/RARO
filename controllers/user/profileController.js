const User = require("../../models/userSchema");


const loadProfile = async (req, res) => {
    try {
        return res.render("profile", {
        });
    } catch (error) {
        console.log("profile page not found");
        res.status(500).send("server error");
    }
}

module.exports = {
    loadProfile
}
