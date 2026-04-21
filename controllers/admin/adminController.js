const adminService = require("../../services/adminService");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");





const pageError = async (req, res) => {
    res.render("pageError");
}

const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect("/admin/dashboard");
    }
    res.render("admin-login", { message: null });
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await adminService.findAdminByEmail(email);
        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if (passwordMatch) {
                req.session.admin = true;
                return res.redirect("/admin");
            } else {
                return res.render("admin-login", { message: "Incorrect password" });
            }
        } else {
            return res.render("admin-login", { message: "Admin not found with this email" });
        }


    } catch (error) {
        console.log("login error", error);
        return res.redirect("/pageError")
    }
}


const loadDashboard = async (req, res) => {
    try {
        if (req.session.admin) {
            res.render("dashboard");
        }else{
            return res.redirect("/admin/login");
        }
    } catch (error) {
        res.redirect("/pageError");
    }
}


const logout = async (req, res) => {
    try {
        req.session.destroy(error => {
            if (error) {
                console.log("error destroying session", error);
                return res.redirect("/pageError")
            }
            res.redirect("/admin/login")
        })
    } catch (error) {
        console.log("unexpected error during logout", error);
        res.redirect("/pageError");

    }
}

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout
}