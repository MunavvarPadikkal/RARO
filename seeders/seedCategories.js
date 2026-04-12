require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const Category = require("../models/categorySchema");

const MONGO_URI = process.env.MONGODB_URI;

const categories = [
    { name: "Men", description: "Premium t-shirts designed for men with modern fits and styles" },
    { name: "Women", description: "Elegant and stylish t-shirts crafted for women" },
    { name: "Oversized", description: "Relaxed fit oversized t-shirts for a streetwear look" },
    { name: "Minimal", description: "Clean and minimal designs for a timeless aesthetic" },
    { name: "Street Art Graphic", description: "Bold street art inspired graphic printed t-shirts" },
    { name: "Customized", description: "Personalized and customized t-shirts made to order" }
];

async function seedCategories() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");

        for (const cat of categories) {
            const exists = await Category.findOne({ name: { $regex: new RegExp("^" + cat.name + "$", "i") } });
            if (!exists) {
                await Category.create(cat);
                console.log(`✓ Created category: ${cat.name}`);
            } else {
                console.log(`- Category already exists: ${cat.name}`);
            }
        }

        console.log("\nSeeding complete!");
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error("Error seeding categories:", error);
        process.exit(1);
    }
}

seedCategories();
