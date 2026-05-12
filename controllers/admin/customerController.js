const customerService = require("../../services/customerService");


const customerInfo = async (req,res)=>{
    try {
        let search = "";
        if(req.query.search){
            search = req.query.search;
        }
        let page = 1;
        if(req.query.page){
            page = req.query.page
        }
        const limit = 3;
        const { data: userData, count } = await customerService.getCustomerInfo(search, page, limit);

        const totalPages = Math.ceil(count / limit);
        res.render("customers", { data: userData, totalPages, currentPage: page, search: req.query.search || "" });

    } catch (error) {
        console.error("Error in customerInfo:", error);
        res.redirect("/admin/pageError");
    }
}


const customerBlocked = async (req,res)=>{
    try {
        let id = req.query.id;
        await customerService.updateCustomerBlockStatus(id, true);
        res.redirect("/admin/customers");
    } catch (error) {
        res.redirect("/admin/pageError");
    }
}

const customerunBlocked = async (req,res)=>{
    try {
        let id = req.query.id;
        await customerService.updateCustomerBlockStatus(id, false);
        res.redirect("/admin/customers");
    } catch (error) {
        res.redirect("/admin/pageError");
    }
}


module.exports = {
    customerInfo,
    customerBlocked,
    customerunBlocked
}