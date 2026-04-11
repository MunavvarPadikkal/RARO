const User = require("../models/userSchema");

const getCustomerInfo = async (search, page, limit) => {
    const query = {
        isAdmin: false,
        $or: [
            { name: { $regex: ".*" + search + ".*", $options: "i" } },
            { email: { $regex: ".*" + search + ".*", $options: "i" } }
        ]
    };
    const data = await User.find(query).sort({ createdOn: -1 }).limit(limit).skip((page - 1) * limit).exec();
    const count = await User.countDocuments(query);
    return { data, count };
};

const updateCustomerBlockStatus = async (id, isBlocked) => {
    return await User.updateOne({ _id: id }, { $set: { isBlocked: isBlocked } });
};

module.exports = {
    getCustomerInfo,
    updateCustomerBlockStatus
};
