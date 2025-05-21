const Coupon = require('../../models/couponSchema')
const Cart = require('../../models/cartSchema')
const HttpStatus = require('../../config/httpStatusCode')

const applyCoupon = async (req, res) => {
    try {
        const { couponCode, totalAmount } = req.body

        const userId = req.session.user._id

        const couponData = await Coupon.findOne({ name: couponCode })
        if (!couponData) {
            return res.json({ success: false, message: "Invalid coupon code" })
        }

        if (couponData.usedBy.includes(userId)) {
            return res.json({ success: false, message: "User already used this coupon" })
        }

        if (couponData.expireOn && new Date(couponData.expireOn) < new Date()) {
            return res.json({ success: false, message: "Coupon has expired" })
        }

        if (couponData.minPrice > totalAmount) {
            return res.json({
                success: false,
                message: `Minimum ₹${couponData.minPrice} required`,
            })
        }

        const cart = await Cart.findOne({ userId }).populate("items.productId")
        if (!cart || cart.items.length === 0) {
            return res.json({ success: false, message: "Cart is empty" })
        }

        const discountAmount = couponData.offerPrice
        const newTotal = totalAmount - discountAmount

        const cartTotalValue = cart.items.reduce(
            (sum, item) => sum + item.totalPrice,
            0
        )

        const discountDetails = cart.items.map((item) => {
            const itemContribution = item.totalPrice / cartTotalValue
            const itemDiscount = discountAmount * itemContribution
            return {
                productId: item.productId._id,
                qty: item.qty,
                originalPrice: item.totalPrice,
                discount: itemDiscount,
                discountedPrice: item.totalPrice - itemDiscount,
            }
        })

        await couponData.save()

        return res.json({ success: true, discountAmount, newTotal, couponCode, discountDetails, })

    } catch (error) {
        console.error("Error verifying Apply offer", error)
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Server error applying offer",
        })
    }
}



const cancelCoupon = async (req, res) => {
    try {
        const { couponCode } = req.body;
        const userId = req.session.user._id;

        const coupon = await Coupon.findOne({ name: couponCode });
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Coupon not found" });
        }

        // Remove user from usedBy list (if exists)
        coupon.usedBy = coupon.usedBy.filter(id => id.toString() !== userId.toString());
        await coupon.save();

        return res.status(200).json({ success: true, message: "Coupon cancelled successfully" });

    } catch (error) {
        console.error("Error cancelling coupon:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Server error cancelling coupon",
        });
    }
};

module.exports = {
    applyCoupon,
    cancelCoupon,

}