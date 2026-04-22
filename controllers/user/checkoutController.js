const orderService = require("../../services/orderService");

/**
 * GET /checkout
 * Render the dynamic checkout page.
 * Redirects to /cart if cart is empty or invalid.
 */
const loadCheckout = async (req, res) => {
    try {
        const userId = req.session.user._id;

        const {
            cartItems,
            addresses,
            subtotal,
            discount,
            shippingCharge,
            finalAmount,
            itemsCount,
        } = await orderService.getCheckoutData(userId);

        return res.render("checkout", {
            user: req.session.user,
            cartItems,
            addresses,
            subtotal,
            discount,
            shippingCharge,
            finalAmount,
            itemsCount,
        });
    } catch (error) {
        if (error.message === "CART_EMPTY") {
            return res.redirect("/cart");
        }
        console.error("Error loading checkout:", error);
        // If cart has validation issues, redirect to cart with an error flag
        return res.redirect("/cart?error=" + encodeURIComponent(error.message));
    }
};

/**
 * POST /checkout/place-order
 * Validate, create order, deduct stock, clear cart, redirect to success.
 */
const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { addressId } = req.body;

        if (!addressId) {
            return res.status(400).json({
                success: false,
                message: "Please select a delivery address.",
            });
        }

        const order = await orderService.placeOrder(userId, addressId);

        return res.json({
            success: true,
            message: "Order placed successfully!",
            orderId: order._id,
        });
    } catch (error) {
        console.error("Error placing order:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to place order. Please try again.",
        });
    }
};

/**
 * GET /order-success/:orderId
 * Render the order success page.
 */
const orderSuccess = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await orderService.getOrderById(orderId);

        if (!order) {
            return res.redirect("/");
        }

        // Security: ensure the order belongs to the logged-in user
        if (order.userId.toString() !== req.session.user._id.toString()) {
            return res.redirect("/");
        }

        return res.render("order-success", {
            user: req.session.user,
            order,
        });
    } catch (error) {
        console.error("Error loading order success page:", error);
        return res.redirect("/");
    }
};

module.exports = {
    loadCheckout,
    placeOrder,
    orderSuccess,
};
