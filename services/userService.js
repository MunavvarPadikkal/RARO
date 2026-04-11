const User = require("../models/userSchema");

const findUserById = async (id) => {
    return await User.findById(id);
};

const findUserByEmail = async (email) => {
    return await User.findOne({ email });
};

const findCustomerByEmail = async (email) => {
    return await User.findOne({ isAdmin: false, email });
};

const createUser = async (userData) => {
    const user = new User(userData);
    return await user.save();
};

const updateUserPassword = async (email, passwordHash) => {
    return await User.updateOne({ email }, { $set: { password: passwordHash } });
};

module.exports = {
    findUserById,
    findUserByEmail,
    findCustomerByEmail,
    createUser,
    updateUserPassword
};
