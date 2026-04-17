const productService = require("../../services/productService");
const categoryService = require("../../services/categoryService");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const PRODUCT_IMG_DIR = path.join(__dirname, "../../public/uploads/productImages");


// ── Helper: process uploaded images with sharp ─────────────────────────
async function processImages(files) {
    const processedNames = [];
    for (const file of files) {
        const outputName = `product-${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;
        const outputPath = path.join(PRODUCT_IMG_DIR, outputName);
        await sharp(file.path)
            .resize(800, 800, { fit: "cover" })
            .webp({ quality: 85 })
            .toFile(outputPath);
        // Remove original uploaded file
        fs.unlink(file.path, () => {});
        processedNames.push(outputName);
    }
    return processedNames;
}


// ── List Products Page ─────────────────────────────────────────────────
const getProducts = async (req, res) => {
    try {
        let search = req.query.search || "";
        let page = parseInt(req.query.page) || 1;
        const limit = 6;

        const { data: products, count } = await productService.getProducts(search, page, limit);
        const totalPages = Math.ceil(count / limit);

        res.render("products", {
            products,
            totalPages,
            currentPage: page,
            search
        });
    } catch (error) {
        console.error("Error in getProducts:", error);
        res.redirect("/admin/pageError");
    }
};


// ── Add Product Form ───────────────────────────────────────────────────
const getAddProduct = async (req, res) => {
    try {
        const { data: categories } = await categoryService.getCategoryInfo("", 1, 100);
        const listedCategories = categories.filter(c => c.isListed);
        res.render("addProduct", { categories: listedCategories });
    } catch (error) {
        console.error("Error loading add product page:", error);
        res.redirect("/admin/pageError");
    }
};


// ── Add Product POST ───────────────────────────────────────────────────
const addProduct = async (req, res) => {
    try {
        const { productName, description, highlights, additionalInfo, category, regularPrice, salePrice, color, sizeS, sizeM, sizeL } = req.body;

        // Validation
        if (!productName || !description || !category || !regularPrice || !salePrice || !color) {
            return res.status(400).json({ error: "All fields are required" });
        }

        if (!req.files || req.files.length < 3) {
            return res.status(400).json({ error: "Minimum 3 product images are required" });
        }

        // Check duplicate product name
        const Product = require("../../models/productSchema");
        const duplicate = await Product.findOne({
            productName: { $regex: new RegExp("^" + productName.trim() + "$", "i") },
            isDeleted: false
        });
        if (duplicate) {
            return res.status(409).json({ error: "Product with this name already exists" });
        }

        // Process images with sharp
        const imageNames = await processImages(req.files);

        const sizes = [
            { size: "S", quantity: parseInt(sizeS) || 0 },
            { size: "M", quantity: parseInt(sizeM) || 0 },
            { size: "L", quantity: parseInt(sizeL) || 0 },
        ];

        const totalQty = sizes.reduce((sum, s) => sum + s.quantity, 0);

        const productData = {
            productName: productName.trim(),
            description: description.trim(),
            highlights: highlights ? highlights.split('\n').map(h => h.trim()).filter(h => h.length > 0) : [],
            additionalInfo: additionalInfo ? additionalInfo.trim() : "",
            category,
            regularPrice: parseFloat(regularPrice),
            salePrice: parseFloat(salePrice),
            color: color.split(',').map(c => c.trim()).filter(c => c.length > 0),
            sizes,
            productImage: imageNames,
            status: totalQty > 0 ? "Available" : "Out of stock",
        };

        await productService.addProduct(productData);
        return res.json({ success: true, message: "Product added successfully" });
    } catch (error) {
        console.error("Error adding product:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};


// ── Edit Product Form ──────────────────────────────────────────────────
const getEditProduct = async (req, res) => {
    try {
        const id = req.query.id;
        const product = await productService.getProductById(id);
        if (!product) return res.redirect("/admin/products");

        const { data: categories } = await categoryService.getCategoryInfo("", 1, 100);
        const listedCategories = categories.filter(c => c.isListed);

        res.render("editProduct", { product, categories: listedCategories });
    } catch (error) {
        console.error("Error loading edit product:", error);
        res.redirect("/admin/pageError");
    }
};


// ── Edit Product POST ──────────────────────────────────────────────────
const editProduct = async (req, res) => {
    try {
        const { id, productName, description, highlights, additionalInfo, category, regularPrice, salePrice, color, sizeS, sizeM, sizeL } = req.body;

        if (!productName || !description || !category || !regularPrice || !salePrice || !color) {
            return res.status(400).json({ error: "All fields are required" });
        }

        // Check duplicate
        const Product = require("../../models/productSchema");
        const duplicate = await Product.findOne({
            productName: { $regex: new RegExp("^" + productName.trim() + "$", "i") },
            _id: { $ne: id },
            isDeleted: false
        });
        if (duplicate) {
            return res.status(409).json({ error: "Product with this name already exists" });
        }

        const sizes = [
            { size: "S", quantity: parseInt(sizeS) || 0 },
            { size: "M", quantity: parseInt(sizeM) || 0 },
            { size: "L", quantity: parseInt(sizeL) || 0 },
        ];
        const totalQty = sizes.reduce((sum, s) => sum + s.quantity, 0);

        const updateData = {
            productName: productName.trim(),
            description: description.trim(),
            highlights: highlights ? highlights.split('\n').map(h => h.trim()).filter(h => h.length > 0) : [],
            additionalInfo: additionalInfo ? additionalInfo.trim() : "",
            category,
            regularPrice: parseFloat(regularPrice),
            salePrice: parseFloat(salePrice),
            color: color.split(',').map(c => c.trim()).filter(c => c.length > 0),
            sizes,
            status: totalQty > 0 ? "Available" : "Out of stock",
        };

        // Process new images if uploaded
        if (req.files && req.files.length > 0) {
            const newImages = await processImages(req.files);
            const existing = await productService.getProductById(id);
            updateData.productImage = [...existing.productImage, ...newImages];
        }

        await productService.updateProduct(id, updateData);
        return res.json({ success: true, message: "Product updated successfully" });
    } catch (error) {
        console.error("Error editing product:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};


// ── Soft Delete ────────────────────────────────────────────────────────
const deleteProduct = async (req, res) => {
    try {
        const { id } = req.body;
        await productService.softDeleteProduct(id);
        return res.json({ success: true, message: "Product deleted successfully" });
    } catch (error) {
        console.error("Error deleting product:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};


// ── Restore ────────────────────────────────────────────────────────────
const restoreProduct = async (req, res) => {
    try {
        const { id } = req.body;
        await productService.restoreProduct(id);
        return res.json({ success: true, message: "Product restored successfully" });
    } catch (error) {
        console.error("Error restoring product:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};


// ── Block / Unblock ────────────────────────────────────────────────────
const blockProduct = async (req, res) => {
    try {
        const { id } = req.body;
        await productService.toggleProductBlock(id, true);
        return res.json({ success: true, message: "Product blocked" });
    } catch (error) {
        console.error("Error blocking product:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const unblockProduct = async (req, res) => {
    try {
        const { id } = req.body;
        await productService.toggleProductBlock(id, false);
        return res.json({ success: true, message: "Product unblocked" });
    } catch (error) {
        console.error("Error unblocking product:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};


// ── Delete Single Image ────────────────────────────────────────────────
const deleteProductImage = async (req, res) => {
    try {
        const { productId, imageName } = req.body;
        const product = await productService.getProductById(productId);
        if (!product) return res.status(404).json({ error: "Product not found" });

        if (product.productImage.length <= 3) {
            return res.status(400).json({ error: "Product must have at least 3 images" });
        }

        // Remove file from disk
        const imgPath = path.join(PRODUCT_IMG_DIR, imageName);
        if (fs.existsSync(imgPath)) {
            fs.unlinkSync(imgPath);
        }

        await productService.removeProductImage(productId, imageName);
        return res.json({ success: true, message: "Image deleted" });
    } catch (error) {
        console.error("Error deleting product image:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};


module.exports = {
    getProducts,
    getAddProduct,
    addProduct,
    getEditProduct,
    editProduct,
    deleteProduct,
    restoreProduct,
    blockProduct,
    unblockProduct,
    deleteProductImage
};
