const Category = require("../models/categorySchema");

const getCategoryInfo = async (search, page, limit) => {
    const query = search
        ? { name: { $regex: ".*" + search + ".*", $options: "i" } }
        : {};
    const data = await Category.find(query).sort({ createdAt: -1 }).limit(limit).skip((page - 1) * limit).exec();
    const count = await Category.countDocuments(query);
    return { data, count };
};

const addCategory = async (name, description) => {
    const existingCategory = await Category.findOne({ name: { $regex: new RegExp("^" + name + "$", "i") } });
    if (existingCategory) {
        throw new Error("Category already exists");
    }
    const newCategory = new Category({ name, description });
    return await newCategory.save();
};

const toggleCategoryListing = async (id, isListed) => {
    return await Category.updateOne({ _id: id }, { $set: { isListed } });
};

const getCategoryById = async (id) => {
    return await Category.findById(id);
};

const updateCategory = async (id, name, description) => {
    const existingCategory = await Category.findOne({
        name: { $regex: new RegExp("^" + name + "$", "i") },
        _id: { $ne: id }
    });
    if (existingCategory) {
        throw new Error("Category name already exists");
    }
    return await Category.updateOne({ _id: id }, { $set: { name, description } });
};

const addCategoryOffer = async (id, offer) => {
    return await Category.updateOne({ _id: id }, { $set: { categoryOffer: offer } });
};

const removeCategoryOffer = async (id) => {
    return await Category.updateOne({ _id: id }, { $set: { categoryOffer: 0 } });
};

module.exports = {
    getCategoryInfo,
    addCategory,
    toggleCategoryListing,
    getCategoryById,
    updateCategory,
    addCategoryOffer,
    removeCategoryOffer
};
