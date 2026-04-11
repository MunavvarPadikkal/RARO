const User = require("../models/userSchema");

const findAdminByEmail = async (email) => {
    return await User.findOne({ email, isAdmin: true });
}

module.exports = {
    findAdminByEmail
};
