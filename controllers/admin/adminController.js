const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { session } = require("passport");



const pageerror = async (req, res) => {
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
            const orderCount = await Order.countDocuments()


            const orders = await Order.find({ status: "Delivered" })

            let totalRevenue = orders.reduce((total, order) => {

                console.log(order.finalAmount)
                total += order.finalAmount
                return total

            }, 0)

            totalRevenue = parseFloat(totalRevenue).toFixed(2)


            // const topProducts = await topSellingHandler()
            const topProducts = await getTopSellingProducts(10);
            const topCategories = await getTopSellingCategories(10);

            const recentOrders = await getRecentOrders()
            const salesData = await getSalesDataHelper("monthly")
            const orderStatusCounts = await getOrderStatusCounts()


            const dashboardData = {
                productCount,
                userCount,
                orderCount,

                totalRevenue,
                topProducts,
                topCategories,
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



// Admin Dashboard -------------------


const topSellingHandler = async (req, res) => {
    try {
        const { type } = req.query;

        if (type === "categories") {
            const categories = await getTopSellingCategories(); // add this function too
            res.json({ categories });
        } else {
            const products = await getTopSellingProducts(5);
            res.json({ products });
        }
    } catch (error) {
        console.error("Error in top selling handler:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getTopSelling = async (req, res) => {
    try {
        const { type } = req.query;

        if (type === "categories") {
            const topCategories = await Order.aggregate([
                { $match: { status: "Delivered" } },
                {
                    $lookup: {
                        from: "products",
                        localField: "product",
                        foreignField: "_id",
                        as: "productDetails",
                    },
                },
                { $unwind: "$productDetails" },
                {
                    $lookup: {
                        from: "categories",
                        localField: "productDetails.category",
                        foreignField: "_id",
                        as: "categoryDetails",
                    },
                },
                { $unwind: "$categoryDetails" },
                {
                    $group: {
                        _id: "$categoryDetails._id",
                        name: { $first: "$categoryDetails.name" },
                        productCount: { $addToSet: "$productDetails._id" },
                        soldCount: { $sum: "$qty" },
                        totalSales: { $sum: { $multiply: ["$price", "$qty"] } },
                    },
                },
                {
                    $project: {
                        _id: 1,
                        name: 1,
                        productCount: { $size: "$productCount" },
                        soldCount: 1,
                        totalSales: 1,
                    },
                },
                { $sort: { soldCount: -1 } },
                { $limit: 10 },
            ]);

            res.json({ categories: topCategories });
        } else {
            const topProducts = await Order.aggregate([
                { $match: { status: "Delivered" } },
                {
                    $group: {
                        _id: "$product",
                        soldCount: { $sum: "$qty" },
                        totalSales: { $sum: { $multiply: ["$price", "$qty"] } },
                    },
                },
                { $sort: { soldCount: -1 } },
                { $limit: 10 },
                {
                    $lookup: {
                        from: "products",
                        localField: "_id",
                        foreignField: "_id",
                        as: "productDetails",
                    },
                },
                { $unwind: "$productDetails" },
                {
                    $lookup: {
                        from: "categories",
                        localField: "productDetails.category",
                        foreignField: "_id",
                        as: "categoryDetails",
                    },
                },
                { $unwind: "$categoryDetails" },
                {
                    $project: {
                        _id: 1,
                        name: "$productDetails.name",
                        category: "$categoryDetails.name",
                        price: "$productDetails.salePrice",
                        image: { $arrayElemAt: ["$productDetails.photos", 0] },
                        soldCount: 1,
                        totalSales: 1,
                    },
                },
            ]);

            res.json({ products: topProducts });
        }
    } catch (error) {
        console.error("Error in getTopSelling API:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};


const getTopSellingCategories = async () => {
    try {
        const categoryReport = await Order.aggregate([
            { $match: { status: "Delivered" } },

            {
                $lookup: {
                    from: "products",
                    localField: "product",
                    foreignField: "_id",
                    as: "productDetails",
                },
            },
            { $unwind: "$productDetails" },

            {
                $lookup: {
                    from: "categories",
                    localField: "productDetails.category",
                    foreignField: "_id",
                    as: "categoryDetails",
                },
            },
            { $unwind: { path: "$categoryDetails", preserveNullAndEmptyArrays: true } },

            {
                $group: {
                    _id: "$categoryDetails._id",
                    categoryName: { $first: "$categoryDetails.name" },
                    totalSoldQty: { $sum: "$qty" },
                    totalRevenue: { $sum: "$finalAmount" },
                },
            },

            { $sort: { totalSoldQty: -1 } },
        ]);

        return categoryReport;
    } catch (error) {
        console.error("Error generating category-wise report:", error);
        return [];
    }
};


const getTopSellingProducts = async (limit = 5) => {

    try {
        const topProducts = await Order.aggregate([
            { $match: { status: "Delivered" } },
            {
                $group: {
                    _id: "$product",
                    soldCount: { $sum: "$qty" },
                    totalSales: { $sum: "$finalAmount" },
                },
            },
            { $sort: { soldCount: -1 } },
            { $limit: limit },
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "productDetails",
                },
            },
            { $unwind: "$productDetails" },
            {
                $lookup: {
                    from: "categories",
                    localField: "productDetails.category",
                    foreignField: "_id",
                    as: "categoryDetails",
                },
            },
            { $unwind: { path: "$categoryDetails", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    name: "$productDetails.name",
                    category: "$categoryDetails.name",
                    price: "$productDetails.salePrice",
                    image: { $arrayElemAt: ["$productDetails.photos", 0] },
                    soldCount: 1,
                    totalSales: 1,
                },
            },
        ]);

        return topProducts;
    } catch (error) {
        console.error("Error getting top products:", error);
        return [];
    }
};

const getRecentOrders = async (limit = 10) => {
    try {
        const recentOrders = await Order.find().sort({ createdOn: -1 }).limit(limit)
        const ordersWithCustomers = await Promise.all(
            recentOrders.map(async (order) => {
                const customer = await User.findById(order.userId)
                return {
                    ...order.toObject(),
                    customerName: customer ? `${customer.username} ${customer.email}` : "Unknown",
                }
            }),
        )

        return ordersWithCustomers
    } catch (error) {
        console.error("Error getting recent orders:", error)
        return []
    }
}


const getSalesData = async (req, res) => {
    try {
        const { period = "monthly" } = req.query

        const salesData = await getSalesDataHelper(period)
        res.json(salesData)
    } catch (error) {
        console.error("Error in getSalesData API:", error)
        res.status(500).json({ error: "Internal server error" })
    }
}


const getSalesDataHelper = async (period = "yearly") => {
    try {
        const now = new Date()
        const labels = []
        const data = []

        if (period === "weekly") {

            for (let i = 6; i >= 0; i--) {
                const date = new Date(now)
                date.setDate(date.getDate() - i)

                const dayStart = new Date(date.setHours(0, 0, 0, 0))
                const dayEnd = new Date(date.setHours(23, 59, 59, 999))

                const dayOrders = await Order.find({
                    createdOn: { $gte: dayStart, $lte: dayEnd },
                    status: "Delivered",
                })

                const daySales = dayOrders.reduce((total, order) => total + order.finalAmount, 0)

                labels.push(date.toLocaleDateString("en-US", { weekday: "short" }))
                data.push(daySales)
            }
        } else if (period === "monthly") {

            for (let i = 5; i >= 0; i--) {
                const date = new Date(now)
                date.setMonth(date.getMonth() - i)

                const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
                const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)

                const monthOrders = await Order.find({
                    createdOn: { $gte: monthStart, $lte: monthEnd },
                    status: "Delivered",
                })

                const monthSales = monthOrders.reduce((total, order) => total + order.finalAmount, 0)

                labels.push(date.toLocaleDateString("en-US", { month: "short" }))
                data.push(monthSales)
            }
        } else if (period === "yearly") {

            for (let i = 4; i >= 0; i--) {
                const year = now.getFullYear() - i

                const yearStart = new Date(year, 0, 1)
                const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999)

                const yearOrders = await Order.find({
                    createdOn: { $gte: yearStart, $lte: yearEnd },
                    status: "Delivered",
                })

                const yearSales = yearOrders.reduce((total, order) => total + order.finalAmount, 0)

                labels.push(year.toString())
                data.push(yearSales)
            }
        }

        return { labels, data }
    } catch (error) {
        console.error("Error getting sales data:", error)
        return { labels: [], data: [] }
    }
}

const getOrderStatusCounts = async () => {
    try {
        const statusCounts = {
            Delivered: 0,
            Pending: 0,
            Confirmed: 0,
            Shipped: 0,
            Cancelled: 0,
            Return_Request: 0,
            Returned: 0,
        }

        const orders = await Order.find()

        orders.forEach((order) => {
            if (order.status === "Delivered") statusCounts["Delivered"]++
            else if (order.status === "Pending") statusCounts["Pending"]++
            else if (order.status === "Confirmed") statusCounts["Confirmed"]++
            else if (order.status === "Shipped") statusCounts["Shipped"]++
            else if (order.status === "Cancelled") statusCounts["Cancelled"]++
            else if (order.status === "Return_Request") statusCounts["Return_Request"]++
            else if (order.status === "Returned") statusCounts["Returned"]++
        })

        return statusCounts
    } catch (error) {
        console.error("Error getting order status counts:", error)
        return { Delivered: 0, Pending: 0, Shipped: 0, Cancelled: 0, Returned: 0, Confirmed: 0, Return_Request: 0 }
    }
}


// Export the function
module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
    getTopSelling,
    getSalesData

};
