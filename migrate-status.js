const mongoose = require('mongoose');
const Order = require('./models/orderSchema');
require('dotenv').config();

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/raro');
        console.log('Connected to MongoDB');

        const result = await Order.updateMany(
            { orderStatus: 'Confirmed' },
            { $set: { orderStatus: 'Pending' } }
        );
        console.log(`Updated ${result.modifiedCount} orders from Confirmed to Pending`);

        // Also update statusHistory
        const historyResult = await Order.updateMany(
            { "statusHistory.status": "Confirmed" },
            { $set: { "statusHistory.$[elem].status": "Pending" } },
            { arrayFilters: [{ "elem.status": "Confirmed" }] }
        );
        console.log(`Updated status history in ${historyResult.modifiedCount} orders`);

        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
