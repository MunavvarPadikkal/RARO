const User = require("../models/userSchema");
const Address = require("../models/addressSchema");

const findUserById = async (userId) => {
    return await User.findById(userId);
};

const findUserByEmail = async (email) => {
    return await User.findOne({ email });
};

const updateUserPhoto = async (userId, imagePath) => {
    return await User.findByIdAndUpdate(userId, { profilePhoto: imagePath });
};

const updateUserDetails = async (userId, updateData) => {
    return await User.findByIdAndUpdate(userId, updateData);
};

const findUserAddress = async (userId) => {
    return await Address.findOne({ userId });
};

const saveUserAddress = async (addressDoc) => {
    return await addressDoc.save();
};

const createUserAddress = async (userId, addressArray) => {
    const userAddress = new Address({ userId, address: addressArray });
    return await userAddress.save();
};

module.exports = {
    findUserById,
    findUserByEmail,
    updateUserPhoto,
    updateUserDetails,
    findUserAddress,
    saveUserAddress,
    createUserAddress
};
