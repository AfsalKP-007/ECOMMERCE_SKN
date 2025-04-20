const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { session } = require("passport");



const pageerror = async (req,res)=>{
    res.render("admin-error")
}
const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect("/admin");
    }
    res.render("admin-login", { message: null });
};


const login = async (req, res) => {

    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ isAdmin: true, email: email });

        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);
      
            if (passwordMatch) {                
                req.session.admin = admin._id;
                return res.redirect('/admin');
            } else {
                return res.redirect('/login');
            }
        } else {
            return res.redirect('/login');
        }
    } catch (error) {
        console.log("Login Error", error);
        return res.redirect('/pageerror');
    }
};

const loadDashboard = async (req, res) => {
    if (req.session.admin) {
      try {
        const productCount = await Product.countDocuments()
        const userCount = await User.countDocuments({ isAdmin: false })
        // const orderCount = await Order.countDocuments()
        const orderCount = 0
  
        // const orders = await Order.find({ status: "delivered" })
        const orders = {}


        // const totalRevenue = orders.reduce((total, order) => total + order.finalAmount, 0)
        const totalRevenue = 0
  
        // const topProducts = await getTopSellingProducts()
        const topProducts = {}
  
        // const recentOrders = await getRecentOrders()
        const recentOrders = {}
  
        // const salesData = await getSalesDataHelper("monthly")
        const salesData = {}
  
        // const orderStatusCounts = await getOrderStatusCounts()
        const orderStatusCounts = {}
  
        const dashboardData = {
          productCount,
          userCount,
          orderCount,
          totalRevenue,
          topProducts,
          recentOrders,
          salesData: salesData.data,
          salesLabels: salesData.labels,
          orderStatusData: Object.values(orderStatusCounts),
          orderStatusLabels: Object.keys(orderStatusCounts),
        }
  
        res.render("dashboard", { dashboardData })
      } catch (error) {
        console.error("Dashboard Error:", error)
        res.redirect("/pageerror")
      }
    } else {
      return res.redirect("/admin/login")
    }
  }
  

const logout = async (req, res) => {
    try {

            if (req.session.admin) {
                req.session.admin = null;
                console.log("Admin session cleared");
            }

            res.redirect("/admin/login");
            
        // req.session.destroy(err => {
        //     if (err) {
        //         console.log("Error destroying session", err);
        //         return res.redirect("/pageerror");
        //     }
        //     res.redirect("/admin/login");
        // });
    } catch (error) {
        console.log("Unexpected error:", error);
        res.redirect("/pageerror");
    }
};


// Export the function
module.exports = { 
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout

 };
