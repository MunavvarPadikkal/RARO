const wishlistService = require("../../services/wishlistService");

const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { wishlist, products } = await wishlistService.getWishlist(userId);
        res.render("wishlist", { wishlist, products, user: req.session.user });
    } catch (error) {
        console.error("Error loading wishlist:", error);
        res.redirect("/pageNotFound");
    }
};

const addToWishlist = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: "Please login to add to wishlist" });
        }

        const userId = req.session.user._id;
        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({ success: false, message: "Missing product ID" });
        }

        const result = await wishlistService.addToWishlist(userId, productId);
        const wishlistCount = result.wishlist.products.length;
        
        if (result.existing) {
            res.json({ success: true, message: "Product is already in your wishlist", wishlistCount });
        } else {
            res.json({ success: true, message: "Added to wishlist successfully", wishlistCount });
        }

    } catch (error) {
        console.error("Error adding to wishlist:", error);
        res.status(400).json({ success: false, message: error.message || "Failed to add to wishlist" });
    }
};

const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({ success: false, message: "Missing product ID" });
        }

        const updatedWishlist = await wishlistService.removeFromWishlist(userId, productId);
        res.json({ success: true, message: "Removed from wishlist", wishlistCount: updatedWishlist.products.length });

    } catch (error) {
        console.error("Error removing from wishlist:", error);
        res.status(400).json({ success: false, message: "Failed to remove item" });
    }
};

module.exports = {
    loadWishlist,
    addToWishlist,
    removeFromWishlist
};
