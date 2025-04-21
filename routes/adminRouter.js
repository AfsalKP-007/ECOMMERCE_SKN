const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const { userAuth, adminAuth, adminAuthCheck } = require("../middlewares/auth");
const categoryController = require("../controllers/admin/categoryController");
const productController = require("../controllers/admin/productController");
const orderController = require("../controllers/admin/orderController");
const couponController = require("../controllers/admin/couponController");

const multer = require('multer');
const upload = multer();



router.get("/pageerror", adminController.pageerror);


// Login & Logout
router.get("/", adminAuth, adminController.loadDashboard);
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/adminLogout", adminController.logout);

// Customer OR User
router.get("/users", adminAuth, customerController.customerInfo);
router.patch("/block", adminAuth, customerController.blockUser);
router.patch("/unblock", adminAuth, customerController.unblockUser);

// Category
router.get("/categories", adminAuth, categoryController.categories);
router.post("/addCategory", adminAuth, categoryController.addCategory);
router.put("/editCategory/:id", adminAuth, categoryController.editCategory);
router.patch("/deleteCategory/:id", adminAuth, categoryController.deleteCategory);



// Product
router.get("/products", adminAuth, productController.getAllProducts);
router.get("/addProduct", adminAuth, productController.getProductAddPage);
router.post("/addProduct", adminAuth, upload.fields([
    { name: "image1", maxCount: 1 },
    { name: "image2", maxCount: 1 },
    { name: "image3", maxCount: 1 },
    { name: "image4", maxCount: 1 },
]), productController.addProducts);

router.post("/saveImage", adminAuth, upload.single("image"), productController.saveImage);
router.post("/changeImage", adminAuth, upload.single('image'), productController.changeImage);

router.patch("/blockProduct", productController.blockProduct);
router.patch("/unblockProduct", productController.unblockProduct);
router.patch('/deleteProduct', adminAuth, productController.deleteProduct);

router.get("/editProduct", adminAuth, productController.getEditProduct)
router.post("/editProduct/:id", adminAuth, upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 }
]), productController.editProduct);

router.post("/deleteImage", adminAuth, productController.deleteSingleImage)


// Coupons
router.get('/coupons', adminAuth, couponController.loadCoupon)
router.post('/addCoupon', adminAuth, couponController.createCoupon)
router.put('/editCoupon/:id', adminAuth, couponController.updateCoupon)
router.patch("/deletecoupon",adminAuth,couponController.deletecoupon)


// ORDERS

router.get('/orders', adminAuth, orderController.getorderList)
router.get('/orders/:orderId', adminAuth, orderController.getorderdetails)
router.post('/orders/cancel', adminAuth, orderController.orderCancelled)
router.post('/orders/update-status', adminAuth, orderController.updateStatus)
router.post('/orders/handle-return', orderController.orderReturn)

module.exports = router;
