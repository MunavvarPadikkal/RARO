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

/**
 * GET /download-invoice/:orderId
 * Render the dedicated invoice preview page for PDF generation.
 */
const downloadInvoice = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await orderService.getOrderById(orderId);

        if (!order) {
            return res.status(404).send("Order not found");
        }

        // Security check
        if (order.userId.toString() !== req.session.user._id.toString()) {
            return res.status(403).send("Unauthorized");
        }

        return res.render("invoice", {
            user: req.session.user,
            order,
        });
    } catch (error) {
        console.error("Error loading invoice preview:", error);
        return res.status(500).send("Internal Server Error");
    }
};

/**
 * DEV ONLY: Preview invoice with dummy data
 */
const devInvoicePreview = async (req, res) => {
    try {
        const dummyOrder = {
            orderId: "DEV-MOCK-123",
            createdOn: new Date(),
            paymentMethod: "Razorpay (Test)",
            orderStatus: "Success",
            shippingAddress: {
                name: "John Developer",
                phone: "9876543210",
                landMark: "Tech Park",
                city: "Innovate City",
                state: "Dev State",
                pincode: "400001"
            },
            orderedItems: [
                {
                    productName: "Premium Cotton Shirt",
                    color: "Navy Blue",
                    size: "XL",
                    quantity: 2,
                    itemTotal: 2998.00
                },
                {
                    productName: "Slim Fit Chinos",
                    color: "Beige",
                    size: "32",
                    quantity: 1,
                    itemTotal: 1499.00
                }
            ],
            subtotal: 4497.00,
            discount: 500.00,
            shippingCharge: 0,
            finalAmount: 3997.00
        };

        return res.render("invoice", {
            order: dummyOrder,
            user: { name: "Tester" }
        });
    } catch (error) {
        res.status(500).send("Error rendering dev preview");
    }
};

module.exports = {
    loadCheckout,
    placeOrder,
    orderSuccess,
    downloadInvoice,
    devInvoicePreview
};
