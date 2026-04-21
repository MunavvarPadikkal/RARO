const cartService = require("../../services/cartService");

const loadCart = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { cart, subtotal, itemsCount } = await cartService.getCart(userId);
        res.render("cart", { cart, subtotal, itemsCount, user: req.session.user });
    } catch (error) {
        console.error("Error loading cart:", error);
        res.redirect("/pageNotFound");
    }
};

const addToCart = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { productId, size, quantity } = req.body;

        if (!productId || !size || !quantity) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        await cartService.addToCart(userId, productId, size, quantity);
        res.json({ success: true, message: "Added to cart successfully" });

    } catch (error) {
        console.error("Error adding to cart:", error);
        res.status(400).json({ success: false, message: error.message || "Failed to add to cart" });
    }
};

const updateQuantity = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { productId, size, quantity } = req.body;

        if (!productId || !size || !quantity) {
             return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        await cartService.updateQuantity(userId, productId, size, quantity);
        res.json({ success: true, message: "Quantity updated" });

    } catch (error) {
        console.error("Error updating quantity:", error);
        res.status(400).json({ success: false, message: error.message || "Failed to update quantity" });
    }
};

const removeFromCart = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { productId, size } = req.body;

        if (!productId || !size) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        await cartService.removeFromCart(userId, productId, size);
        res.json({ success: true, message: "Removed from cart" });

    } catch (error) {
        console.error("Error removing from cart:", error);
        res.status(400).json({ success: false, message: "Failed to remove item" });
    }
};

module.exports = {
    loadCart,
    addToCart,
    updateQuantity,
    removeFromCart
};
