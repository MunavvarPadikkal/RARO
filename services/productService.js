const Product = require("../models/productSchema");
const Category = require("../models/categorySchema");

const getProducts = async (search, page, limit) => {
    const query = { isDeleted: false };
    if (search) {
        query.productName = { $regex: ".*" + search + ".*", $options: "i" };
    }
    const data = await Product.find(query)
        .populate("category", "name")
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .exec();
    const count = await Product.countDocuments(query);
    return { data, count };
};

const getProductById = async (id) => {
    return await Product.findById(id).populate("category", "name");
};

const addProduct = async (productData) => {
    const newProduct = new Product(productData);
    return await newProduct.save();
};

const updateProduct = async (id, updateData) => {
    return await Product.findByIdAndUpdate(id, { $set: updateData }, { new: true });
};

const softDeleteProduct = async (id) => {
    return await Product.findByIdAndUpdate(id, { $set: { isDeleted: true } });
};

const restoreProduct = async (id) => {
    return await Product.findByIdAndUpdate(id, { $set: { isDeleted: false } });
};

const toggleProductBlock = async (id, isBlocked) => {
    return await Product.findByIdAndUpdate(id, { $set: { isBlocked } });
};

const removeProductImage = async (productId, imageToRemove) => {
    return await Product.findByIdAndUpdate(productId, {
        $pull: { productImage: imageToRemove }
    }, { new: true });
};

const getShopProducts = async ({ search, category, sort, page, limit, minPrice, maxPrice, sizes }) => {
    // Get listed category IDs
    const listedCategories = await Category.find({ isListed: true }).select("_id");
    const listedCategoryIds = listedCategories.map(c => c._id);

    const query = {
        isDeleted: false,
        isBlocked: false
    };

    if (category) {
        // If a category is selected, it must be both the selected category AND listed
        if (listedCategoryIds.map(id => id.toString()).includes(category.toString())) {
            query.category = category;
        } else {
            // Selected category is not listed, ensure no products are returned
            query.category = { $in: [] };
        }
    } else {
        query.category = { $in: listedCategoryIds };
    }

    if (search) {
        query.productName = { $regex: ".*" + search + ".*", $options: "i" };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
        query.salePrice = {};
        if (minPrice !== undefined) query.salePrice.$gte = minPrice;
        if (maxPrice !== undefined) query.salePrice.$lte = maxPrice;
    }

    if (sizes && sizes.length > 0) {
        query.sizes = {
            $elemMatch: {
                size: { $in: sizes },
                quantity: { $gt: 0 }
            }
        };
    }

    let sortOption = { createdAt: -1 };
    switch (sort) {
        case "price-asc":
            sortOption = { salePrice: 1 };
            break;
        case "price-desc":
            sortOption = { salePrice: -1 };
            break;
        case "name-asc":
            sortOption = { productName: 1 };
            break;
        case "name-desc":
            sortOption = { productName: -1 };
            break;
        case "newest":
        default:
            sortOption = { createdAt: -1 };
            break;
    }

    const data = await Product.find(query)
        .populate("category", "name")
        .sort(sortOption)
        .limit(limit)
        .skip((page - 1) * limit)
        .exec();
    const count = await Product.countDocuments(query);
    return { data, count };
};

module.exports = {
    getProducts,
    getProductById,
    addProduct,
    updateProduct,
    softDeleteProduct,
    restoreProduct,
    toggleProductBlock,
    removeProductImage,
    getShopProducts
};
