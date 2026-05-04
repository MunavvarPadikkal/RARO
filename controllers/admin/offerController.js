const Offer = require("../../models/offerSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const offerService = require("../../services/offerService");

const loadOffers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const search = req.query.search || "";
        
        let query = { isDeleted: false };
        if (search) {
            query.name = { $regex: new RegExp(search, "i") };
        }

        const count = await Offer.countDocuments(query);
        const offers = await Offer.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate("selectedProducts", "productName")
            .populate("selectedCategories", "name");

        const totalPages = Math.ceil(count / limit);

        res.render("offers", {
            offers,
            currentPage: page,
            totalPages,
            search,
            activeTab: "offers"
        });
    } catch (error) {
        console.error("Error loading offers:", error);
        res.redirect("/pageNotFound");
    }
};

const loadAddOffer = async (req, res) => {
    try {
        const products = await Product.find({ isDeleted: false }).select("productName _id");
        const categories = await Category.find({ isListed: true }).select("name _id");
        
        res.render("add-offer", {
            products,
            categories,
            activeTab: "offers"
        });
    } catch (error) {
        console.error("Error loading add offer page:", error);
        res.redirect("/pageNotFound");
    }
};

const addOffer = async (req, res) => {
    try {
        const {
            name,
            offerType,
            discountType,
            discountValue,
            maxDiscount,
            selectedProducts,
            selectedCategories,
            startDate,
            expiryDate,
        } = req.body;

        // Validation
        const existingOffer = await Offer.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
        if (existingOffer) {
            return res.status(400).json({ success: false, message: "Offer with this name already exists" });
        }

        if (new Date(startDate) >= new Date(expiryDate)) {
            return res.status(400).json({ success: false, message: "Expiry date must be after start date" });
        }

        if (discountType === "Percentage" && discountValue > 100) {
            return res.status(400).json({ success: false, message: "Percentage discount cannot exceed 100%" });
        }

        const newOffer = new Offer({
            name,
            offerType,
            discountType,
            discountValue: parseFloat(discountValue),
            maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
            selectedProducts: offerType === "Product" ? (Array.isArray(selectedProducts) ? selectedProducts : [selectedProducts]) : [],
            selectedCategories: offerType === "Category" ? (Array.isArray(selectedCategories) ? selectedCategories : [selectedCategories]) : [],
            startDate: new Date(startDate),
            expiryDate: new Date(expiryDate),
            isActive: true
        });

        await newOffer.save();
        
        // Sync product prices based on new offer
        await offerService.syncProductPrices();

        res.json({ success: true, message: "Offer created successfully" });
    } catch (error) {
        console.error("Error adding offer:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const toggleOfferStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const offer = await Offer.findById(id);
        if (!offer) {
            return res.status(404).json({ success: false, message: "Offer not found" });
        }

        offer.isActive = !offer.isActive;
        await offer.save();

        // Sync product prices
        await offerService.syncProductPrices();

        res.json({ success: true, message: `Offer ${offer.isActive ? "activated" : "deactivated"} successfully` });
    } catch (error) {
        console.error("Error toggling offer status:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const deleteOffer = async (req, res) => {
    try {
        const { id } = req.params;
        await Offer.findByIdAndUpdate(id, { isDeleted: true, isActive: false });

        // Sync product prices
        await offerService.syncProductPrices();

        res.json({ success: true, message: "Offer deleted successfully" });
    } catch (error) {
        console.error("Error deleting offer:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const loadEditOffer = async (req, res) => {
    try {
        const { id } = req.params;
        const offer = await Offer.findById(id).populate("selectedProducts").populate("selectedCategories");
        if (!offer) {
            return res.redirect("/admin/offers");
        }

        const products = await Product.find({ isDeleted: false }).select("productName _id");
        const categories = await Category.find({ isListed: true }).select("name _id");
        
        res.render("edit-offer", {
            offer,
            products,
            categories,
            activeTab: "offers"
        });
    } catch (error) {
        console.error("Error loading edit offer page:", error);
        res.redirect("/pageNotFound");
    }
};

const editOffer = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            offerType,
            discountType,
            discountValue,
            maxDiscount,
            selectedProducts,
            selectedCategories,
            startDate,
            expiryDate,
        } = req.body;

        const offer = await Offer.findById(id);
        if (!offer) {
            return res.status(404).json({ success: false, message: "Offer not found" });
        }

        // Validation
        const existingOffer = await Offer.findOne({ 
            name: { $regex: new RegExp(`^${name}$`, "i") },
            _id: { $ne: id }
        });
        if (existingOffer) {
            return res.status(400).json({ success: false, message: "Offer with this name already exists" });
        }

        if (new Date(startDate) >= new Date(expiryDate)) {
            return res.status(400).json({ success: false, message: "Expiry date must be after start date" });
        }

        if (discountType === "Percentage" && discountValue > 100) {
            return res.status(400).json({ success: false, message: "Percentage discount cannot exceed 100%" });
        }

        offer.name = name;
        offer.offerType = offerType;
        offer.discountType = discountType;
        offer.discountValue = parseFloat(discountValue);
        offer.maxDiscount = maxDiscount ? parseFloat(maxDiscount) : null;
        offer.selectedProducts = offerType === "Product" ? (Array.isArray(selectedProducts) ? selectedProducts : [selectedProducts]) : [];
        offer.selectedCategories = offerType === "Category" ? (Array.isArray(selectedCategories) ? selectedCategories : [selectedCategories]) : [];
        offer.startDate = new Date(startDate);
        offer.expiryDate = new Date(expiryDate);

        await offer.save();
        
        // Sync product prices
        await offerService.syncProductPrices();

        res.json({ success: true, message: "Offer updated successfully" });
    } catch (error) {
        console.error("Error updating offer:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

module.exports = {
    loadOffers,
    loadAddOffer,
    addOffer,
    loadEditOffer,
    editOffer,
    toggleOfferStatus,
    deleteOffer
};
