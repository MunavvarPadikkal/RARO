const categoryService = require("../../services/categoryService");


const categoryInfo = async (req, res) => {
    try {
        let search = "";
        if (req.query.search) {
            search = req.query.search;
        }
        let page = 1;
        if (req.query.page) {
            page = parseInt(req.query.page);
        }
        const limit = 4;
        const { data: categoryData, count } = await categoryService.getCategoryInfo(search, page, limit);

        const totalPages = Math.ceil(count / limit);
        res.render("categories", {
            cat: categoryData,
            totalPages,
            currentPage: page,
            search: req.query.search || ""
        });
    } catch (error) {
        console.error("Error in categoryInfo:", error);
        res.redirect("/admin/pageError");
    }
};


const addCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name || !description) {
            return res.status(400).json({ error: "Name and description are required" });
        }
        await categoryService.addCategory(name.trim(), description.trim());
        return res.json({ success: true, message: "Category added successfully" });
    } catch (error) {
        if (error.message === "Category already exists") {
            return res.status(409).json({ error: "Category already exists" });
        }
        console.error("Error adding category:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};


const listCategory = async (req, res) => {
    try {
        const id = req.query.id;
        await categoryService.toggleCategoryListing(id, true);
        res.redirect("/admin/categories");
    } catch (error) {
        console.error("Error listing category:", error);
        res.redirect("/admin/pageError");
    }
};


const unlistCategory = async (req, res) => {
    try {
        const id = req.query.id;
        await categoryService.toggleCategoryListing(id, false);
        res.redirect("/admin/categories");
    } catch (error) {
        console.error("Error unlisting category:", error);
        res.redirect("/admin/pageError");
    }
};


const getEditCategory = async (req, res) => {
    try {
        const id = req.query.id;
        const category = await categoryService.getCategoryById(id);
        res.render("edit-category", { category });
    } catch (error) {
        console.error("Error getting edit category:", error);
        res.redirect("/admin/pageError");
    }
};


const editCategory = async (req, res) => {
    try {
        const { id, name, description } = req.body;
        if (!name || !description) {
            return res.status(400).json({ error: "Name and description are required" });
        }
        await categoryService.updateCategory(id, name.trim(), description.trim());
        return res.json({ success: true, message: "Category updated successfully" });
    } catch (error) {
        if (error.message === "Category name already exists") {
            return res.status(409).json({ error: "Category name already exists" });
        }
        console.error("Error editing category:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};


const addOffer = async (req, res) => {
    try {
        const { id, offer } = req.body;
        await categoryService.addCategoryOffer(id, parseInt(offer));
        return res.json({ success: true, message: "Offer added successfully" });
    } catch (error) {
        console.error("Error adding offer:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};


const removeOffer = async (req, res) => {
    try {
        const { id } = req.body;
        await categoryService.removeCategoryOffer(id);
        return res.json({ success: true, message: "Offer removed successfully" });
    } catch (error) {
        console.error("Error removing offer:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};


module.exports = {
    categoryInfo,
    addCategory,
    listCategory,
    unlistCategory,
    getEditCategory,
    editCategory,
    addOffer,
    removeOffer
};
