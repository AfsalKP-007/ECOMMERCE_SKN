const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");



const productDetails = async (req, res) => {

    try {

        const userId = req.session.user;
        const userData = await User.findById(userId);
        const productId = req.query.id;

        const product = await Product.findById(productId).populate('category')
        const findCategory = product.category;

        const categoryOffer = findCategory ? findCategory.offer || 0 : 0;
        const productOffer = product.productOffer || 0;


        const totalOffer = Math.max(categoryOffer, productOffer)


        // PRICE AFTER DISCOUNT
        const priceAfterDiscount = parseFloat((product.salePrice * (1 - totalOffer / 100)).toFixed(2));

        const categories = await Category.find({ isListed: true });
        const categoryIds = categories.map(category => category._id.toString());

        const products = await Product.find({
            isBlocked: false,
            category: { $in: categoryIds },
            stock: { $gt: 0 },
        })
            .sort({ createdAt: -1 })
            .skip(0)
            .limit(9);

        res.render("product-details", {
            user: userData,
            product: product,
            products: products,
            stock: product.stock,
            totalOffer: totalOffer,
            priceAfterDiscount: priceAfterDiscount,
            category: findCategory
        })


    } catch (error) {

        console.error("Error for fetching product details", error)
        res.redirect("/pageNotFound")
    }
}


module.exports = {
    productDetails
}