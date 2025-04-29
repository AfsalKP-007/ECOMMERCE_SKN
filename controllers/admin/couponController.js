const Coupon = require('../../models/couponSchema')
const moment = require('moment')
const HttpStatus = require('../../config/httpStatusCode')


const loadCoupon = async (req, res) => {
    try {
        const findCoupons = await Coupon.find({ active: true });
        return res.render('coupons', { coupons: findCoupons });
    } catch (error) {
        console.error('error occurred while loading coupons', error);
        return res.redirect('pageerror');
    }
}


const createCoupon = async (req, res) => {
    try {
        const { couponName, startDate, endDate, offerPrice, minimumPrice } = req.body;

        // Validate required fields
        if (!couponName || !startDate || !endDate || !offerPrice || !minimumPrice) {
            return res.status(400).json({
                success: false,
                message: 'All fields (couponName, startDate, endDate, offerPrice, minimumPrice) are required',
            });
        }

        // Validate and create dates
        const createdOn = new Date(`${startDate}T00:00:00`);
        const expireOn = new Date(`${endDate}T00:00:00`);

        if (isNaN(createdOn.getTime()) || isNaN(expireOn.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format for startDate or endDate. Use YYYY-MM-DD format.',
            });
        }

        // Validate numeric fields
        const offerPriceNum = parseInt(offerPrice);
        const minPriceNum = parseInt(minimumPrice);
        if (isNaN(offerPriceNum) || isNaN(minPriceNum)) {
            return res.status(400).json({
                success: false,
                message: 'offerPrice and minimumPrice must be valid numbers',
            });
        }

        const data = {
            couponName,
            createdOn,
            expireOn,
            offerPrice: offerPriceNum,
            minPrice: minPriceNum,
        };

        const newCoupon = new Coupon({
            name: data.couponName,
            createdOn: data.createdOn,
            expireOn: data.expireOn,
            offerPrice: data.offerPrice,
            minPrice: data.minPrice,
        });

        await newCoupon.save();

        return res.status(201).json({
            success: true,
            message: 'Coupon created successfully',
            coupon: newCoupon,
        });
    } catch (error) {
        console.error('Error occurred while creating coupon:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message,
        });
    }
};

// const createCoupon = async (req, res) => {
//     try {
//         const data = {
//             couponName: req.body.couponName,
//             createdOn: new Date(req.body.startDate + 'T00:00:00'),
//             expireOn: new Date(req.body.endDate + 'T00:00:00'),
//             offerPrice: parseInt(req.body.offerPrice),
//             minPrice: parseInt(req.body.minimumPrice)
//         };

//         const newCoupon = new Coupon({
//             name: data.couponName,
//             createdOn: data.createdOn,
//             expireOn: data.expireOn,
//             offerPrice: data.offerPrice,
//             minPrice: data.minPrice
//         });

//         await newCoupon.save();

//         return res.status(201).json({
//             success: true,
//             message: 'Coupon created successfully',
//             coupon: newCoupon
//         });

//     } catch (error) {
//         console.error('Error occurred while creating coupon:', error);

//         return res.status(500).json({
//             success: false,
//             message: 'Internal server error',
//             error: error.message
//         });
//     }
// };



const deletecoupon = async (req, res) => {
    try {
        const { id: couponId } = req.body;

        if (!couponId) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: "Coupon ID is required.",
            });
        }

        const deletedCoupon = await Coupon.findByIdAndUpdate(
            couponId,
            { active: false },
            { new: true } // return updated document
        );

        if (!deletedCoupon) {
            return res.status(HttpStatus.NOT_FOUND).json({
                success: false,
                message: "Coupon not found.",
            });
        }

        res.json({
            success: true,
            message: "Coupon marked as deleted successfully!",
        });
    } catch (error) {
        console.error("Error occurred while deleting coupon:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
};



const editCoupon = async (req, res) => {
    try {
        const { id } = req.params
        const couponData = await Coupon.findById(id)

        if (!couponData) {
            console.error('Coupon not found for id:', id)
            return res.redirect('pageerror')
        }

        const formattedCouponData = {
            ...couponData._doc,
            createdOn: couponData.createdOn ? moment(couponData.createdOn).format('YYYY-MM-DD') : '',
            expireOn: couponData.expireOn ? moment(couponData.expireOn).format('YYYY-MM-DD') : ''
        }

        return res.render('coupon-edit', { couponData: formattedCouponData })
    } catch (error) {
        console.error('Error occurred while loading coupon:', error)
        return res.redirect('pageerror')
    }
}


const updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const { couponName, startDate, endDate, offerPrice, minimumPrice } = req.body;

        const couponData = await Coupon.findById(id);
        if (!couponData) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        couponData.name = couponName;
        couponData.createdOn = new Date(startDate + 'T00:00:00');
        couponData.expireOn = new Date(endDate + 'T00:00:00');
        couponData.offerPrice = parseInt(offerPrice);
        couponData.minPrice = parseInt(minimumPrice);

        await couponData.save();

        return res.status(200).json({ success: true, message: 'Coupon updated successfully' });

    } catch (error) {
        console.error('Error while updating coupon:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};


module.exports = {
    loadCoupon,
    createCoupon,
    deletecoupon,
    editCoupon,
    updateCoupon
}