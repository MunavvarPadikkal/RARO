const orderService = require("../../services/orderService");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const walletService = require("../../services/walletService");

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
            appliedCoupon
        } = await orderService.getCheckoutData(userId);

        const wallet = await walletService.getWallet(userId);
        
        // Fetch available coupons
        const Coupon = require("../../models/couponSchema");
        const now = new Date();
        const availableCoupons = await Coupon.find({
            isActive: true,
            isDeleted: false,
            startDate: { $lte: now },
            expiryDate: { $gte: now },
            $expr: { $lt: ["$usageCount", "$totalUsageLimit"] }
        }).lean();

        // Filter coupons based on user-specific limits
        const filteredCoupons = availableCoupons.filter(coupon => {
            const userUsage = coupon.usersUsed.find(u => u.userId.toString() === userId.toString());
            const userUsageCount = userUsage ? userUsage.count : 0;
            return userUsageCount < coupon.perUserLimit;
        });

        return res.render("checkout", {
            user: req.session.user,
            cartItems,
            addresses,
            subtotal,
            discount,
            shippingCharge,
            finalAmount,
            itemsCount,
            appliedCoupon,
            walletBalance: wallet.balance,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
            availableCoupons: filteredCoupons
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
        const { addressId, paymentMethod, paymentStatus, razorpayPaymentId, razorpayOrderId, razorpaySignature, walletAmountUsed = 0 } = req.body;

        if (!addressId) {
            return res.status(400).json({
                success: false,
                message: "Please select a delivery address.",
            });
        }

        if (paymentMethod === "Razorpay" && paymentStatus !== "Failed") {
            const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
            hmac.update(razorpayOrderId + "|" + razorpayPaymentId);
            const generatedSignature = hmac.digest("hex");

            if (generatedSignature !== razorpaySignature) {
                return res.status(400).json({ success: false, message: "Payment verification failed." });
            }
        }

        const paymentDetails = {
            razorpayOrderId,
            razorpayPaymentId
        };

        const order = await orderService.placeOrder(userId, addressId, paymentMethod, paymentStatus, paymentDetails, walletAmountUsed);

        // If wallet was used, deduct it now (after order is successfully created in DB)
        if (walletAmountUsed > 0 && paymentStatus !== "Failed") {
            await walletService.debitWallet(userId, walletAmountUsed, `Payment for Order #${order.orderId}`, order.orderId);
        }

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
 * POST /checkout/create-razorpay-order
 * Create a new order in Razorpay for checkout.
 */
const createRazorpayOrder = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { walletAmountUsed = 0 } = req.body;
        const checkoutData = await orderService.getCheckoutData(userId);

        const instance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const amountToPay = checkoutData.finalAmount - walletAmountUsed;
        if (amountToPay < 0) {
             return res.status(400).json({ success: false, message: "Wallet amount exceeds total" });
        }

        const options = {
            amount: Math.round(amountToPay * 100), // convert to paise
            currency: "INR",
            receipt: "receipt_order_" + Date.now(),
        };

        const order = await instance.orders.create(options);

        if (!order) {
            return res.status(500).json({ success: false, message: "Error creating Razorpay order" });
        }

        return res.json({ success: true, razorpayOrder: order });
    } catch (error) {
        console.error("Error creating razorpay order:", error);
        return res.status(500).json({ success: false, message: "Server error creating payment" });
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

/**
 * GET /payment-failed/:orderId
 * Render the payment failure page.
 */
const paymentFailed = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await orderService.getOrderById(orderId);

        if (!order) {
            return res.redirect("/");
        }

        if (order.userId.toString() !== req.session.user._id.toString()) {
            return res.redirect("/");
        }

        return res.render("payment-failed", {
            user: req.session.user,
            order,
        });
    } catch (error) {
        console.error("Error loading payment failure page:", error);
        return res.redirect("/");
    }
};

/**
 * POST /checkout/retry-payment/:orderId
 * Reopen Razorpay for a failed order.
 */
const retryPayment = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.session.user._id;

        const order = await orderService.getOrderById(orderId);
        
        if (!order || order.userId.toString() !== userId.toString()) {
            return res.status(400).json({ success: false, message: "Order not found" });
        }
        
        if (order.paymentStatus !== "Failed") {
            return res.status(400).json({ success: false, message: "Order is not in Failed status" });
        }

        try {
            await orderService.checkStockForOrder(order);
        } catch (stockError) {
            return res.status(400).json({ success: false, message: stockError.message });
        }

        return res.json({ 
            success: true, 
            razorpayOrderId: order.razorpayOrderId,
            amount: order.finalAmount,
            key: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error("Error initiating retry payment:", error);
        return res.status(500).json({ success: false, message: "Server error initiating payment retry" });
    }
};

/**
 * POST /checkout/verify-retry
 * Verify Razorpay signature after a retry.
 */
const verifyRetryPayment = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

        const order = await orderService.getOrderById(orderId);
        if (!order || order.userId.toString() !== userId.toString()) {
            return res.status(400).json({ success: false, message: "Order not found" });
        }

        // Verify signature
        const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
        hmac.update(razorpayOrderId + "|" + razorpayPaymentId);
        const generatedSignature = hmac.digest("hex");

        if (generatedSignature !== razorpaySignature) {
            return res.status(400).json({ success: false, message: "Payment verification failed." });
        }

        // Update order status and deduct stock
        order.paymentStatus = "Paid";
        order.orderStatus = "Placed";
        order.razorpayPaymentId = razorpayPaymentId;
        order.statusHistory.push({ status: "Placed", date: new Date(), note: "Payment retried successfully" });
        
        await orderService.deductStockForOrder(order);
        
        // If order has a coupon, increment its usage
        if (order.couponApplied) {
            let couponIdToUse = order.couponId;
            
            // Fallback for older orders that only have the code
            if (!couponIdToUse && order.couponCode) {
                const Coupon = require("../../models/couponSchema");
                const coupon = await Coupon.findOne({ code: order.couponCode });
                if (coupon) couponIdToUse = coupon._id;
            }
            
            if (couponIdToUse) {
                await orderService.incrementCouponUsage(couponIdToUse, userId);
            }
        }
        
        await order.save();

        return res.json({
            success: true,
            message: "Payment successful!",
            orderId: order._id,
        });
    } catch (error) {
        console.error("Error verifying retry payment:", error);
        return res.status(500).json({ success: false, message: "Server error verifying payment" });
    }
};

module.exports = {
    loadCheckout,
    placeOrder,
    createRazorpayOrder,
    orderSuccess,
    downloadInvoice,
    devInvoicePreview,
    paymentFailed,
    retryPayment,
    verifyRetryPayment
};
