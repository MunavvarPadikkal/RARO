const mongoose = require('mongoose');
require('dotenv').config();
const Order = require('../models/orderSchema');

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const forbidden = ['Return Rejected', 'Return Approved', 'Partially Cancelled', 'Partially Returned'];
        const orders = await Order.find({ orderStatus: { $in: forbidden } });
        console.log(`Orders with forbidden statuses: ${orders.length}`);
        orders.forEach(o => console.log(`${o.orderId}: ${o.orderStatus}`));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
