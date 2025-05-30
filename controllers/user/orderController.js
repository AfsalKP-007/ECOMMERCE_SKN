const Order = require('../../models/orderSchema')
const User = require('../../models/userSchema')
const Cart = require('../../models/cartSchema')
const Address = require('../../models/addressSchema')
const Product = require('../../models/productSchema')
const Coupon = require('../../models/couponSchema')
const Transaction = require('../../models/transactionSchema')
const Wallet = require('../../models/walletSchema')
const Razorpay = require('razorpay')
const crypto = require('crypto')
const HttpStatus = require('../../config/httpStatusCode')


const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
})

const addOrder = async (req, res) => {
  try {
    const { address, paymentMethod, totalAmount, couponCode } = req.body

    const userId = req.session.user
    const addresss = await Address.findOne(
      { userId: userId, "address._id": address },
      { "address.$": 1 }
    )
    const addressData = addresss && addresss.address.length > 0 ? addresss.address[0] : null

    const user = await User.findById(userId)
    const cart = await Cart.findOne({ userId }).populate("items.productId")

    if (!cart || cart.items.length === 0) {
      return res.status(HttpStatus.BAD_REQUEST).redirect("/pageNotFound")
    }

    const singleCouponCode = Array.isArray(couponCode) ? couponCode[0] : couponCode

    let discountAmount = 0

    let discountDetails = cart.items.map((item) => ({
      productId: item.productId._id,
      qty: item.qty,
      price: item.salePrice,
      discount: 0,
      discountedPrice: item.totalPrice,
    }))

    if (singleCouponCode) {
      const couponData = await Coupon.findOne({ name: singleCouponCode })
      if (couponData && couponData.minPrice <= totalAmount) {
        discountAmount = couponData.offerPrice
        const cartTotalValue = cart.items.reduce(
          (sum, item) => sum + item.totalPrice,
          0
        )

        discountDetails = cart.items.map((item) => {

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
      }
    }



    // Making Summary---

    let grandTotalAmount = cart.items.reduce((acc, item) => {
      acc += item.totalPrice
      return acc
    }, 0)

    let subTotalPriceAfterDiscount = cart.items.reduce((acc, item) => {
      acc += item.priceAfterDiscount
      return acc
    }, 0)

    const delivery_Charge = subTotalPriceAfterDiscount <= 2000 ? 50 : 0;  // For ALL item
    const totalItmesCount = cart.items.length


    let orders = []

    for (const item of cart.items) {

      const discountDetail = discountDetails.find(
        (d) => d.productId.toString() === item.productId._id.toString()
      )
      const itemDiscount = discountDetail ? discountDetail.discount : 0

      let finalDeliveryChargeForAnItem = delivery_Charge > 0 ? (delivery_Charge / totalItmesCount) : 0 // Delivery Charge Distributing from here.

      const productOrCategoryOfferAmount = item.totalPrice - item.priceAfterDiscount;

      const totalPrice = Number(item.totalPrice || 0) + Number(item.deliveryCharge || 0)

      const finalItemAmount = Number(item.totalPrice || 0) + Number(finalDeliveryChargeForAnItem || 0) - Number(itemDiscount || 0) - Number(productOrCategoryOfferAmount || 0);


      const newOrder = new Order({
        userId: userId,
        product: item.productId._id,
        price: item.productId.salePrice,
        qty: item.qty,
        totalPrice: totalPrice,
        deliveryCharge: finalDeliveryChargeForAnItem,
        discount: itemDiscount,
        discountAmount: itemDiscount,
        finalAmount: finalItemAmount,
        couponApplied: !!singleCouponCode,
        couponCode: singleCouponCode || null,
        productOrCategoryOfferAmount: productOrCategoryOfferAmount,
        paymentMethod: paymentMethod,
        address: {
          name: addressData.name,
          city: addressData.city,
          state: addressData.state,
          pincode: addressData.pincode,
          landMark: addressData.landMark,
        },
        invoiceDate: new Date(),
        status: "Pending",
        returnReason: "none",
        createdOn: new Date(),
      })

      await newOrder.save()
      orders.push(newOrder)


      /// razor pay
      if (paymentMethod === "razorpay") {
        const { razorpay_payment_id } = req.body;
        console.log(req.body)

        if (!razorpay_payment_id) {
          console.error("Missing razorpay_payment_id");
          return res.redirect("/pageNotFound");
        }

        await Transaction.create({
          userId: userId,
          amount: totalAmount,
          transactionType: "debit",
          paymentMethod: "online",
          paymentGateway: "razorpay",
          gatewayTransactionId: razorpay_payment_id,
          status: "completed",
          purpose: "purchase",
          description: "Online payment for order",
          orders: orders.map((order) => ({
            orderId: order._id,
            amount: order.finalAmount,
          })),
        });
      }

      //-------------------

      if (couponCode) {
        const couponData = await Coupon.findOne({ name: couponCode })
        console.log('couponCode:', couponCode)
        couponData.usedBy.push(userId)
        await couponData.save()
      }

      const product = await Product.findOne({ _id: item.productId._id })
      if (product) {
        product.stock = Math.max(0, product.stock - item.qty)
        await product.save()
      }
    }

    await Cart.findOneAndDelete({ userId })

    const populatedOrders = await Order.find({
      _id: { $in: orders.map((x) => x._id) },
    }).populate("product")

    res.render("orderSuccess", { orders: populatedOrders, user })
  } catch (error) {
    console.error("Error occurred while placing orders:", error)
    return res.redirect("/pageNotFound")
  }
}



const orderSuccess = async (req, res) => {
  try {
    const userId = req.session.user
    if (!userId) {
      return res.redirect('/login')
    }

    const orders = await Order.find({ userId: userId })
      .sort({ createdOn: -1 })
      .populate('product')

    res.render('orderSuccess', { orders })
  } catch (error) {
    console.error('Error occurred while loading order success page:', error)
    return res.redirect('/pageNotFound')
  }
}

const getOrderHistory = async (req, res) => {
  try {
    const userId = req.session.user
    if (!userId) {
      return res.redirect('/login')
    }

    const user = await User.findById(userId)

    let page = parseInt(req.query.page) || 1
    let limit = 5
    if (page < 1) page = 1
    const skip = (page - 1) * limit
    const totalOrders = await Order.countDocuments({ userId })

    const orders = await Order.find({ userId })
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit)
      .populate('product')

    const totalPages = Math.ceil(totalOrders / limit)

    res.render('orderHistory', {
      orders,
      user,
      currentPage: page,
      totalPages,
      limit
    })
  } catch (error) {
    console.error('Error fetching order history:', error)
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).redirect('/pageNotFound')
  }
}

const cancelOrder = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const userId = req.session.user;

    const orderData = await Order.findById(orderId);
    if (!orderData) {
      return res.json({ success: false, message: "Order not found" });
    }

    const product = await Product.findById(orderData.product);
    if (!product) {
      return res.json({ success: false, message: "Product not found" });
    }


    product.stock += orderData.qty;
    await product.save();

    // if (orderData.paymentMethod !== "cod") {

    let totalReturnAmount = orderData.finalAmount - (orderData.discountAmount + orderData.productOrCategoryOfferAmount)

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({
        userId,
        balance: totalReturnAmount,
        transactions: [
          {
            type: "credit",
            amount: totalReturnAmount,
            description: `Refund for order ${orderId} cancellation`,
            date: new Date(),
          },
        ],
      });
    } else {
      wallet.balance += totalReturnAmount;
      wallet.transactions.push({
        type: "credit",
        amount: totalReturnAmount,
        description: `Refund for order ${orderId} cancellation`,
        date: new Date(),
      });
    }
    await wallet.save();

    await Transaction.create({
      userId: userId,
      amount: orderData.finalAmount,
      transactionType: "credit",
      paymentMethod: "refund",
      paymentGateway: "razorpay",
      status: "completed",
      purpose: "refund",
      description: `Payment refund for order ${orderId} cancellation`,
      orders: [{ orderId: orderData._id, amount: orderData.finalAmount }],
      walletBalanceAfter: wallet.balance
    });
    // }

    orderData.status = "Cancelled";
    orderData.returnReason = reason;
    await orderData.save();

    return res.json({ success: true });
  } catch (error) {
    console.error("Error occurred while canceling order:", error);
    return res.redirect("/pageNotFound");
  }
};


const getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate("product")
    if (!order) {
      return res.redirect("/pageNotFound")
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    res.render("orderDetailsForUser", { order, baseUrl })
  } catch (error) {
    console.error("Error fetching order details:", error)
    res.redirect("/pageNotFound")
  }
}

const returnOrder = async (req, res) => {
  try {
    const userId = req.session.user
    const { orderId, reason } = req.body
    console.log('req.body:', req.body)
    const orderData = await Order.findById(orderId)
    if (!orderData) {
      return res.json({ success: false })
    }
    orderData.status = 'Return_Request'
    orderData.returnReason = reason
    await orderData.save()
    return res.json({ success: true, message: 'Your order return request send successfully' })
  } catch (error) {
    console.error('error occur while returnOrder', error)
    return res.redirect('/pageNotFound')
  }
}

const createRazorpay = async (req, res) => {
  try {
    const { totalAmount } = req.body
    if (!totalAmount) {
      return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Total amount missing' })
    }

    const amountInPaise = totalAmount * 100
    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: "receipt#" + Date.now(),
      payment_capture: 1
    }

    const order = await razorpayInstance.orders.create(options)

    return res.json({ success: true, order })
  } catch (error) {
    console.error("Error creating Razorpay order:", error)
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Server error creating order" })
  }
}

const verifyRazorpay = async (req, res) => {
  try {
    const { order_id, payment_id, razorpay_signature } = req.body

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(order_id + '|' + payment_id)
      .digest('hex')

    if (generatedSignature === razorpay_signature) {
      return res.json({ success: true, message: "Payment verified" })
    } else {
      return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: "Invalid signature" })
    }
  } catch (error) {
    console.error("Error verifying Razorpay payment:", error)
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Server error verifying payment" })
  }
}

const loadFailure = async (req, res) => {
  try {
    const { orderId, error } = req.query
    res.render('orderFailure', { orderId: orderId || '', error: error || '' })
  } catch (error) {
    console.error("Error occur while loadFailure:", error)
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).redirect('/pageNotFound')
  }
}

module.exports = {
  addOrder,
  orderSuccess,
  getOrderHistory,
  cancelOrder,
  getOrderDetails,
  returnOrder,
  createRazorpay,
  verifyRazorpay,
  loadFailure
}