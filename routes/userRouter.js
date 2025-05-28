const express = require("express");
const router = express.Router();
const passport = require("passport")
const userController = require("../controllers/user/userController");
const profileController = require("../controllers/user/profileController")
const productController = require("../controllers/user/productController")
const staticController = require("../controllers/user/staticController")
const wishlistController = require("../controllers/user/wishlistController")
const cartController = require("../controllers/user/cartController")
const orderController = require("../controllers/user/orderController")
const couponController = require("../controllers/user/couponController")
const walletController = require("../controllers/user/walletController")


const upload = require('../config/multer')




const { adminAuth, userAuth, userAuthCheck, adminAuthCheck } = require('../middlewares/auth')

router.get("/pageNotFound", userController.pageNotFound);


// STATIC PAGES
router.get("/about", staticController.loadAbout)
router.get("/contact", staticController.loadContact)



// HOME
router.get("/", userController.loadHomePage);


// SIGN
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup)

// OTP
router.get("/verifyOtp", userController.loadOtp)
router.post("/verify-otp", userController.verifyOtp)
router.post("/resend-otp", userController.resendOtp)

// GOOGLE AUTH
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }), async (req, res) => {
    try {
        req.session.user = req.user._id;
        res.redirect('/');
    } catch (error) {
        console.log("Google login error:", error);
        res.redirect('/signup');
    }
});


// LOGIN
router.get("/login", userAuthCheck, userController.loadLoginPage)
router.post("/login", userController.login)
router.get("/logout", userController.logout)

// FORGOT PASSWORD
router.get("/forgot-password", userAuthCheck, profileController.getForgotPassPage)
router.post("/forgot-email-valid", profileController.forgotEmailValid)
router.post("/verify-passForgot-otp", profileController.verifyForgotPassOtp)
router.get("/reset-password", userAuthCheck, profileController.getResetPassPage)
router.post("/reset-password", profileController.postNewPassword);
router.post("/resend-forgot-otp", profileController.resendOtp);


// SHOPPING
router.get("/shop", userController.loadShoppingPage);


// PRODUCT
router.get("/productDetails", userAuth, productController.productDetails);



// PROFILE
router.get("/userProfile", userAuth, profileController.loadProfile);
router.post("/updateProfile", userAuth, profileController.updateProfile);
router.get("/changeEmail", userAuth, profileController.changeEmail);
router.post("/changeEmail", userAuth, profileController.changeEmailValid)
router.post("/verify-email-otp", userAuth, profileController.verifyEmailOtp)
router.post("/update-email", userAuth, profileController.updateEmail)

router.post("/changePassword", userAuth, profileController.changePassword)

router.get('/userProfile/edit/:userId', userAuth, profileController.loadEditProfile)
router.post('/userProfile/edit/:userId', userAuth, profileController.EditProfile)
router.post('/upload-profile-pic/:id', upload.single('profileImage'), profileController.addProfile)



// ADDRESS

router.get("/address", userAuth, profileController.loadAddressPage)
router.get("/addAddress", userAuth, profileController.loadAddAddress)
router.post("/addAddress", userAuth, profileController.updateAddress)

router.get("/editAddress", userAuth, profileController.editAddress);
router.post("/editAddress", userAuth, profileController.postEditAddress)
router.get("/deleteAddress", userAuth, profileController.deleteAddress)
router.post('/setDefaultAddress', userAuth, profileController.updateDefaultAddress)



// WISHLIST

router.post('/addToWishlist', userAuth, wishlistController.addToWishlist)
router.get('/wishlist', userAuth, wishlistController.loadWishlist)
router.delete('/removeFromWishlist', userAuth, wishlistController.removeProduct)

// CART
router.post('/addToCart', cartController.addToCart)
router.get('/cart', userAuth, cartController.loadCart)
router.delete('/removeCartItem', userAuth, cartController.removeCartItem)
router.patch('/updateCartQuantity', userAuth, cartController.updateCartQuantity)


// CHECKOUT
router.get('/checkout', userAuth, cartController.loadCheckOut)


// COUPON
router.post('/applyCoupon', userAuth, couponController.applyCoupon)
router.post('/cancelCoupon', userAuth, couponController.cancelCoupon)



// ORDER  
router.post('/addOrder', userAuth, orderController.addOrder)
router.get('/orderSuccess/:orderId', userAuth, orderController.orderSuccess)
router.get('/orderHistory', userAuth, orderController.getOrderHistory)
router.post('/orders/cancel', userAuth, orderController.cancelOrder)
router.get('/orders/:orderId', userAuth, orderController.getOrderDetails)
router.post('/orders/retun', userAuth, orderController.returnOrder)

// RAZOR PAY
router.post('/api/razorpay/createRazorpayOrder', orderController.createRazorpay)
router.post('/api/razorpay/verifyRazorpayPayment', orderController.verifyRazorpay)
router.get('/orderFailure', orderController.loadFailure)

//WALLET
router.get('/userProfile/wallet/:userId', userAuth, walletController.loadwallet)
router.post("/wallet/create-order", userAuth, walletController.createRazorpayOrder)
router.post("/wallet/payment-success", userAuth, walletController.razorpayPaymentSuccess)



module.exports = router;

