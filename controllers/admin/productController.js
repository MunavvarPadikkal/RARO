const productService = require("../../services/productService");
const categoryService = require("../../services/categoryService");
const offerService = require("../../services/offerService");
const cloudinary = require("../../config/cloudinary");

/**
 * Helper to extract Cloudinary public_id from a secure URL
 * @param {string} url - The Cloudinary secure URL
 * @returns {string|null}
 */
const getPublicIdFromUrl = (url) => {
    if (!url) return null;
    try {
        // Example: https://res.cloudinary.com/cloud_name/image/upload/v1234567/ecommerce/products/abc.jpg
        // public_id would be 'ecommerce/products/abc'
        const parts = url.split('/');
        const uploadIndex = parts.indexOf('upload');
        if (uploadIndex === -1) return null;
        
        // Skip 'upload' and version (starts with 'v')
        const startIndex = parts[uploadIndex + 1].startsWith('v') ? uploadIndex + 2 : uploadIndex + 1;
        const publicIdWithExt = parts.slice(startIndex).join('/');
        return publicIdWithExt.split('.')[0];
    } catch (error) {
        console.error("Error extracting public_id:", error);
        return null;
    }
};


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
        const { productName, description, highlights, additionalInfo, category, regularPrice, salePrice, color, variants: variantsJSON } = req.body;

        // Validation
        if (!productName || !description || !category || !regularPrice || !color || !variantsJSON) {
            console.warn("Validation failed: Missing fields", { productName, category, regularPrice, color });
            return res.status(400).json({ error: "All fields are required" });
        }

        const initialSalePrice = salePrice ? parseFloat(salePrice) : parseFloat(regularPrice);

        if (!req.files || req.files.length < 3) {
            console.warn("Validation failed: Missing images", req.files ? req.files.length : 0);
            return res.status(400).json({ error: "Minimum 3 product images are required" });
        }

        // Check duplicate product name
        const Product = require("../../models/productSchema"); // Keep for local scope consistency or move to top
        const duplicate = await Product.findOne({
            productName: { $regex: new RegExp("^" + productName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "$", "i") },
            isDeleted: false
        });
        if (duplicate) {
            return res.status(409).json({ error: "Product with this name already exists" });
        }

        // Use Cloudinary secure URLs
        const imageNames = req.files.map(file => file.path);

        const variants = JSON.parse(variantsJSON);
        
        // Backend duplicate variant check
        const variantSet = new Set();
        for (const v of variants) {
            const key = `${v.color.toLowerCase()}_${v.size}`;
            if (variantSet.has(key)) {
                return res.status(400).json({ error: `Duplicate variant combination: ${v.color} - ${v.size}` });
            }
            variantSet.add(key);
        }

        const totalQty = variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);

        const productData = {
            productName: productName.trim(),
            description: description.trim(),
            highlights: Array.isArray(highlights) ? highlights : (highlights ? highlights.split('\n').map(h => h.trim()).filter(h => h.length > 0) : []),
            additionalInfo: additionalInfo ? additionalInfo.trim() : "",
            category,
            regularPrice: parseFloat(regularPrice),
            salePrice: initialSalePrice,
            color: Array.isArray(color) ? color : color.split(',').map(c => c.trim()).filter(c => c.length > 0),
            variants,
            productImage: imageNames,
            status: totalQty > 0 ? "Available" : "Out of stock",
        };

        console.log("Adding product with data:", JSON.stringify(productData, null, 2));

        const addedProduct = await productService.addProduct(productData);
        console.log("Product saved successfully:", addedProduct._id);
        
        if (addedProduct && addedProduct._id) {
            await offerService.syncProductPrices(addedProduct._id);
        } else {
            console.error("Product was not saved correctly - addedProduct is null or missing _id");
            return res.status(500).json({ error: "Failed to save product" });
        }

        return res.json({ success: true, message: "Product added successfully" });
    } catch (error) {
        console.error("Error adding product:", error);
        return res.status(500).json({ error: error.message || "Internal server error" });
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
        let { id, productName, description, highlights, additionalInfo, category, regularPrice, salePrice, color, variants: variantsJSON } = req.body;
        id = id.trim();
        console.log("Starting update for product ID:", id);

        if (!productName || !description || !category || !regularPrice || !color || !variantsJSON) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const initialSalePrice = salePrice ? parseFloat(salePrice) : parseFloat(regularPrice);

        // Check duplicate
        const Product = require("../../models/productSchema");
        const duplicate = await Product.findOne({
            productName: { $regex: new RegExp("^" + productName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "$", "i") },
            _id: { $ne: id },
            isDeleted: false
        });
        if (duplicate) {
            return res.status(409).json({ error: "Product with this name already exists" });
        }

        const variants = JSON.parse(variantsJSON);

        // Backend duplicate variant check
        const variantSet = new Set();
        for (const v of variants) {
            const key = `${v.color.toLowerCase()}_${v.size}`;
            if (variantSet.has(key)) {
                return res.status(400).json({ error: `Duplicate variant combination: ${v.color} - ${v.size}` });
            }
            variantSet.add(key);
        }

        const totalQty = variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);

        const updateData = {
            productName: productName.trim(),
            description: description.trim(),
            highlights: Array.isArray(highlights) ? highlights : (highlights ? highlights.split('\n').map(h => h.trim()).filter(h => h.length > 0) : []),
            additionalInfo: additionalInfo ? additionalInfo.trim() : "",
            category,
            regularPrice: parseFloat(regularPrice),
            salePrice: initialSalePrice,
            color: Array.isArray(color) ? color : color.split(',').map(c => c.trim()).filter(c => c.length > 0),
            variants,
            status: totalQty > 0 ? "Available" : "Out of stock",
        };

        console.log("Updating product with data:", JSON.stringify(updateData, null, 2));

        // Handle images to delete
        let imagesToRemove = [];
        if (req.body.imagesToDelete) {
            try {
                imagesToRemove = JSON.parse(req.body.imagesToDelete || "[]");
            } catch (e) {
                imagesToRemove = req.body.imagesToDelete;
                if (typeof imagesToRemove === 'string') {
                    imagesToRemove = JSON.parse(imagesToRemove);
                }
            }
        }

        const existingProduct = await productService.getProductById(id);
        if (!existingProduct) return res.status(404).json({ error: "Product not found" });

        // Calculate final image count
        const newImagesCount = req.files ? req.files.length : 0;
        const finalCount = existingProduct.productImage.length - imagesToRemove.length + newImagesCount;

        if (finalCount < 3) {
            return res.status(400).json({ error: "Product must have at least 3 images" });
        }

        // Perform deletions
        if (imagesToRemove.length > 0) {
            for (const imgUrl of imagesToRemove) {
                const publicId = getPublicIdFromUrl(imgUrl);
                if (publicId) {
                    await cloudinary.uploader.destroy(publicId);
                }
                await productService.removeProductImage(id, imgUrl);
            }
        }

        // Process new images if uploaded
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => file.path);
            // Re-fetch to get updated images after deletions
            const updatedProduct = await productService.getProductById(id);
            if (updatedProduct) {
                updateData.productImage = [...updatedProduct.productImage, ...newImages];
            } else {
                updateData.productImage = newImages;
            }
        }

        const updatedProduct = await productService.updateProduct(id, updateData);
        console.log("Update result from DB:", updatedProduct ? "Success" : "Failed (document not found)");
        
        if (updatedProduct) {
            const offerService = require("../../services/offerService");
            await offerService.syncProductPrices(id);
        } else {
            return res.status(404).json({ error: "Product not found or update failed" });
        }

        return res.json({ success: true, message: "Product updated successfully" });
    } catch (error) {
        console.error("Error editing product:", error);
        return res.status(500).json({ error: error.message || "Internal server error" });
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

        // Remove from Cloudinary
        const publicId = getPublicIdFromUrl(imageName);
        if (publicId) {
            await cloudinary.uploader.destroy(publicId);
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
