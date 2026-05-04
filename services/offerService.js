const Offer = require("../models/offerSchema");
const Product = require("../models/productSchema");
const Category = require("../models/categorySchema");

/**
 * Calculates the best discount for a given product based on active offers.
 * Returns the final discount amount (Number).
 */
const calculateBestDiscount = async (productId, categoryId, regularPrice) => {
    const now = new Date();
    
    // Find active offers applicable to this product or its category
    const activeOffers = await Offer.find({
        isActive: true,
        isDeleted: false,
        startDate: { $lte: now },
        expiryDate: { $gte: now },
        $or: [
            { offerType: "Product", selectedProducts: productId },
            { offerType: "Category", selectedCategories: categoryId }
        ]
    });

    let bestDiscount = 0;

    for (const offer of activeOffers) {
        let currentDiscount = 0;
        
        if (offer.discountType === "Percentage") {
            currentDiscount = (regularPrice * offer.discountValue) / 100;
            if (offer.maxDiscount && currentDiscount > offer.maxDiscount) {
                currentDiscount = offer.maxDiscount;
            }
        } else if (offer.discountType === "Fixed") {
            currentDiscount = offer.discountValue;
        }

        if (currentDiscount > bestDiscount) {
            bestDiscount = currentDiscount;
        }
    }

    // Ensure discount doesn't exceed regular price
    if (bestDiscount > regularPrice) {
        bestDiscount = regularPrice;
    }

    return bestDiscount;
};

/**
 * Syncs the salePrice and productOffer for all products or a specific product
 * based on the currently active offers.
 * This ensures DB-level sorting and filtering works correctly.
 */
const syncProductPrices = async (productId = null) => {
    try {
        let query = { isDeleted: false };
        if (productId) {
            query._id = productId;
        }

        const products = await Product.find(query);

        for (const product of products) {
            const bestDiscount = await calculateBestDiscount(product._id, product.category, product.regularPrice);
            
            const newSalePrice = product.regularPrice - bestDiscount;
            
            // Update only if changed to avoid unnecessary DB writes
            if (product.salePrice !== newSalePrice || product.productOffer !== bestDiscount) {
                product.salePrice = newSalePrice;
                product.productOffer = bestDiscount;
                await product.save();
            }
        }
        return true;
    } catch (error) {
        console.error("Error syncing product prices:", error);
        return false;
    }
};

module.exports = {
    calculateBestDiscount,
    syncProductPrices
};
