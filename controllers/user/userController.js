const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const nodemailer = require("nodemailer");
const env = require("dotenv").config();
const transporter = require("../../config/nodemailer"); // Fixed path
const crypto = require("crypto");
const bcrypt = require("bcrypt")
const { StatusCodes } = require("http-status-codes");
const { log } = require("console");
const Wallet = require("../../models/walletSchema");


async function getCategoryName(id) {
    let category = await Category.find({ _id: id });
    return category && category.name ? category.name : ''
}


const resendOtp = async (req, res) => {
    try {
        const userData = req.session.userData; // Get user details

        if (!userData || !userData.email) {
            return res.status(400).json({ success: false, message: "Email not found in session" });
        }

        const otp = generateOtp(); // Generate new OTP
        req.session.userOtp = otp; // ✅ Store OTP separately

        console.log("New OTP Stored in Session:", req.session.userOtp);


        const emailSent = await sendVerificationEmail(userData.email, otp);

        if (emailSent) {
            console.log("Resend OTP:", otp);
            res.status(200).json({ success: true, message: "OTP Resent Successfully" });
        } else {
            res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again" });
        }
    } catch (error) {
        console.error("Error resending OTP", error);
        res.status(500).json({ success: false, message: "Internal server error. Please try again" });
    }
};

const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;


        const referalCode = req.session.userData.referalCode

        console.log("User Entered OTP:", otp);
        console.log("Stored OTP in Session:", req.session.userOtp);

        if (otp.toString() === req.session.userOtp.toString()) {
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);
            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                googleId: user.googleId || null,
                username: '',
                password: passwordHash,
            });

            await saveUserData.save();
            req.session.user = saveUserData._id;

            // Sign in User WALLET creation =========
            let wallet = await Wallet.findOne({ userId: saveUserData._id });
            if (!wallet) {
                wallet = new Wallet({
                    userId: saveUserData._id,
                    balance: 0,
                    transactions: []
                });

                await wallet.save();
            }
            // =====================


            // Referal User ===============

            const referalBonus = 100

            if (referalCode) {
                const checkReferal = await User.findOne({ referalCode: referalCode })

                if (!checkReferal) {
                    req.session.Emessage = 'Invalid Referal Code, Please try again'
                    return
                }
                const wallet = await Wallet.findOne({ userId: checkReferal._id })
                wallet.balance += referalBonus
                wallet.transactions.push({
                    type: 'credit',
                    amount: referalBonus,
                    description: `Referal Code Credition. for ${ checkReferal.name } `,
                    date: new Date(),
                })
                await wallet.save()
            }
            //====================================================================

            res.json({ success: true, redirectUrl: "/" });
        } else {
            res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
        }
    } catch (error) {
        console.error("Error verifying OTP", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};



const loadSignup = async (req, res) => {
    try {
        res.render("signup");
    } catch (error) {
        console.error("Home page not working", error);
        res.status(500).send("Server Error");
    }
};

const loadOtp = async (req, res) => {
    try {
        res.render("verifyOtp")
    } catch (error) {
        console.error("Error Loading verifyOtp", error)
    }
}


function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}


const sendVerificationEmail = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({

            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        })

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: `Your OTP Is ${otp}`,
            html: `<b>Your OTP Is ${otp}</b>`
        })

        return info.accepted.length > 0


    } catch (error) {
        console.error("ERROR SENDING EMAIL", error)
        return false
    }
};


const signup = async (req, res) => {

    try {

        let { name, phone, email, password, cPassword, referalCode } = req.body;

        password = String(req.body.password).trim();
        cPassword = String(req.body.confirmPassword).trim();

        if (password !== cPassword) {
            return res.status(400).json({ messageType: "passwordError", message: "Password not match." });
        }

        const findUser = await User.findOne({ email });

        if (findUser) {
            return res.status(400).json({ messageType: "emailError", message: "email already exist." });
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);

        if (!emailSent) {
            return res.json("email-error")
        }

        req.session.userOtp = otp;
        req.session.userData = { name, phone, email, password, referalCode };

        res.json({ success: true, redirect: "/verifyOtp", referalCode });

        console.log("OTP Sent", otp)

    } catch (error) {
        console.error("Signup error", error);
        res.redirect("/pageNotFound")
    }
};


const pageNotFound = async (req, res) => {
    try {
        res.render("pageNotFound");
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};


const loadHomePage = async (req, res) => {
    try {
        const user = req.session.user;

        const categories = await Category.find({ isListed: true, status: true });


        let productData = await Product.find({
            isBlocked: false,
            isDeleted: false,
            category: { $in: categories.map(category => category._id) },
            stock: { $gt: 0 }
        })

            .sort({ createdAt: -1 }) // Sort in descending order (latest first)
            .limit(7) // Get only 7 products MAX
            .populate("category")


        if (user) {
            const userData = await User.findOne({ _id: user });
            res.render('home', { user: userData, products: productData });
        } else {
            return res.render('home', { products: productData, req: req });
        }
    } catch (error) {
        console.log('Home Page Not Found');
        res.status(500).send('Server Error');
    }
};



const loadShoppingPage = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = user ? await User.findOne({ _id: user }) : null;

        // Pagination setup
        const page = parseInt(req.query.page) || 1;
        const limit = 6;
        const skip = (page - 1) * limit;


        // Category filter
        const categories = await Category.find({ isListed: true, status: true });
        const categoryIds = categories.map(category => category._id);


        // Initialize query object
        let query = {
            isBlocked: false,
            isDeleted: false,
            category: { $in: categories.map(category => category._id) },
            stock: { $gt: 0 }
        };

        // Search filter
        if (req.query.search) {
            query.name = { $regex: req.query.search, $options: "i" };
        }


        if (req.query.category) {
            query.category = req.query.category; // Match exact category
        } else {
            query.category = { $in: categoryIds }; // Default to all listed categories
        }

        // Sorting options
        let sort = {};
        switch (req.query.sort) {
            case "price_asc":
                sort = { salePrice: 1 };
                break;
            case "price_desc":
                sort = { salePrice: -1 };
                break;
            case "new":
                sort = { createdAt: -1 };
                break;
            case "name_asc":
                sort = { name: 1 };
                break;
            case "name_desc":
                sort = { name: -1 };
                break;
            default:
                sort = { createdAt: -1 }; // Default to latest products
        }

        // Fetch categories with product count
        const categoriesWithCounts = await Category.aggregate([
            {
                $match: { isListed: true, status: true }
            },
            {
                $lookup: {
                    from: "products",
                    let: { categoryId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$category", "$$categoryId"] },
                                        { $eq: ["$isBlocked", false] },
                                        { $gt: ["$stock", 0] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "products"
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    productCount: { $size: "$products" }
                }
            }
        ]);

        // Fetch filtered and sorted products
        const products = await Product.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate("category")

        // Get total product count for pagination
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        // Render shop page with all necessary data
        res.render("shop", {
            user: userData,
            products: products,
            categories: categoriesWithCounts,
            totalProducts: totalProducts,
            currentPage: page,
            totalPages: totalPages,
            search: req.query.search,
            category: req.query.category,
            sort: req.query.sort,
            req: req
        });

    } catch (error) {
        console.error("Error loading shopping page:", error);
        res.status(500).redirect("/pageNotFound");
    }
};



const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10)
        return passwordHash
    }
    catch (error) {
        console.error(error)
    }
}





const loadLoginPage = async (req, res) => {

    try {

        if (!req.session.user) {
            return res.render('login')
        } else {
            res.redirect('/')
        }
    } catch (error) {
        res.redirect('/pagenotfound')
    }
}


const login = async (req, res) => {
    try {
        const { email, password } = req.body;


        const findUser = await User.findOne({ isAdmin: 0, email: email });

        if (!findUser) {
            return res.json({ success: false, message: 'User not found' });
        }
        if (findUser.isBlocked) {
            return res.json({ success: false, message: 'Sorry, This user is blocked by Admin' });
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password);

        if (!passwordMatch) {
            return res.json({ success: false, message: 'Invalid Password' });
        }

        req.session.user = {
            _id: findUser._id,
            name: findUser.name,
            email: findUser.email
        };

        return res.json({ success: true, message: "Login successful" });

    } catch (error) {
        console.error('Login Error', error);
        return res.json({ success: false, message: 'Login Failed. Try again' });
    }
};


const logout = async (req, res) => {
    try {

        if (req.session.user) {
            req.session.user = null;
            console.log("User session cleared");
        }
        return res.redirect("/login");

    } catch (error) {
        console.log("Logout error:", error);
        res.redirect("/pageNotFound");
    }
};

// const logout = async (req, res) => {
//     try {

//         console.log( " CALLED LOGOUT" )
//         req.session.destroy((err) => {
//             if (err) {
//                 console.log("Session destruction error:", err);
//                 return res.redirect("/pageNotFound");
//             }
//             return res.redirect("/login");
//         });
//     } catch (error) {
//         console.log("Logout error:", error);
//         res.redirect("/pageNotFound");
//     }
// };





module.exports = {
    loadHomePage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    loadOtp,
    resendOtp,
    loadLoginPage,
    login,
    logout,
    loadShoppingPage,
};
