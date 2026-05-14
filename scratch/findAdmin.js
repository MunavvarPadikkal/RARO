const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/userSchema');

async function findAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const admin = await User.findOne({ isAdmin: true });
        if (admin) {
            console.log('Admin Email:', admin.email);
        } else {
            console.log('No admin found');
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

findAdmin();
