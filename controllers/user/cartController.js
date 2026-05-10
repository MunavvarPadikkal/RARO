const cartService = require("../../services/cartService");

const loadCart = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { cart, subtotal, itemsCount, discount, finalAmount } = await cartService.getCart(userId);
        res.render("cart", { cart, subtotal, itemsCount, discount, finalAmount, user: req.session.user });
    } catch (error) {
        console.error("Error loading cart:", error);
        res.redirect("/pageNotFound");
    }
};

const addToCart = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { productId, size, color, quantity } = req.body;

        if (!productId || !size || !color || !quantity) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        await cartService.addToCart(userId, productId, size, color, quantity);
        const { itemsCount } = await cartService.getCart(userId);
        res.json({ success: true, message: "Added to cart successfully", itemsCount });

    } catch (error) {
        console.error("Error adding to cart:", error);
        res.status(400).json({ success: false, message: error.message || "Failed to add to cart" });
    }
};

const updateQuantity = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { productId, size, color, quantity } = req.body;

        if (!productId || !size || !color || !quantity) {
             return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        await cartService.updateQuantity(userId, productId, size, color, quantity);
        
        // Fetch updated cart data for AJAX response
        const { cart, subtotal, itemsCount, discount, finalAmount } = await cartService.getCart(userId);
        
        if (!cart) {
            throw new Error("Cart not found after update");
        }

        // Find the updated item total
        let itemTotal = 0;
        const updatedItem = cart.items.find(item => 
            item.productId && item.productId._id.toString() === productId.toString() && 
            item.size === size && 
            item.color === color
        );
        
        if (updatedItem) {
            itemTotal = updatedItem.totalPrice;
        }

        res.json({ 
            success: true, 
            message: "Quantity updated",
            itemTotal,
            subtotal,
            itemsCount,
            discount,
            finalAmount
        });

    } catch (error) {
        console.error("Error updating quantity:", error);
        res.status(error.status || 400).json({ success: false, message: error.message || "Failed to update quantity" });
    }
};

const removeFromCart = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { productId, size, color } = req.body;

        if (!productId || !size || !color) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        await cartService.removeFromCart(userId, productId, size, color);
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
