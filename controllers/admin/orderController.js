const Order = require('../../models/orderSchema')
const User = require('../../models/userSchema')
const Address = require('../../models/addressSchema')
const Product = require('../../models/productSchema')
const Transaction = require('../../models/transactionSchema')
const Wallet = require('../../models/walletSchema')
const HttpStatus = require('../../config/httpStatusCode')


const getorderList = async (req, res) => {
  try {
    const search = req.query.search || '';
    let status = req.query.status || [];
    const page = parseInt(req.query.page) || 1;
    const limit = 8;

    const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : new Date();;
    const toDate = req.query.toDate ? new Date(req.query.toDate) : new Date();;

    // Set fromDate to the start of the day (00:00:00)
    if (fromDate && !isNaN(fromDate)) {
      fromDate.setHours(0, 0, 0, 0); // Set to 12:00 AM
    }

    // Set toDate to the end of the day (23:59:59.999)
    if (toDate && !isNaN(toDate)) {
      toDate.setHours(23, 59, 59, 999); // Set to 11:59:59.999 PM
    }

    if (!Array.isArray(status)) {
      status = [status];
    }

    const query = {};

    // Date range filtering
    if (fromDate && !isNaN(fromDate)) {
      query.createdOn = { ...query.createdOn, $gte: fromDate };
    }
    if (toDate && !isNaN(toDate)) {
      query.createdOn = { ...query.createdOn, $lte: toDate };
    }
    if (fromDate && toDate && !isNaN(fromDate) && !isNaN(toDate)) {
      query.createdOn = { $gte: fromDate, $lte: toDate };
    }

    if (search.trim()) {
      query.$or = [
        { 'address.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Status filtering
    if (status.length > 0 && !status.includes('all')) {
      var normalizedStatus = status.map(s => {
        return s.toLowerCase().split(/[\s_]+/).map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join('');
      });

      // Check if any item contains "ReturnRequest"
      normalizedStatus = normalizedStatus.map(item => {
        if (item.includes("ReturnRequest")) {
          return item.replace("ReturnRequest", "Return_Request");
        }

        return item; // If not, return as it is
      });

      query.status = { $in: normalizedStatus };
    }

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    // Fetch paginated orders
    const orders = await Order.find(query)
      .populate('product')
      .populate('userId')
      .sort({ createdOn: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true, // for AM/PM
      timeZone: 'Asia/Kolkata'
    };


    const localFromDate = fromDate ? fromDate.toLocaleDateString('en-CA') : ''; // 'YYYY-MM-DD' format
    const localToDate = toDate ? toDate.toLocaleDateString('en-CA') : '';     // 'YYYY-MM-DD' format

    const fromDateTime = fromDate.toLocaleString('en-IN', options);
    const toDateTime = toDate.toLocaleString('en-IN', options);

    res.render('orders', {
      orders,
      search,
      status,
      currentPage: page,
      totalPages: totalPages,
      fromDate: fromDate ? localFromDate : '', // For date inputs
      toDate: toDate ? localToDate : '',       // For date inputs
      fromDateTime: fromDate ? fromDateTime : '',
      toDateTime: toDate ? toDateTime : ''
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).send('Internal Server Error');
  }
};



const getorderdetails = async (req, res) => {
  try {
    const orderId = req.params.orderId
    const orderData = await Order.findById(orderId)
      .populate('product')
      .populate('userId')
    res.render('orderDetails', { order: orderData })
  } catch (error) {
    console.error('error occur while getorderdetails', error)
    return res.send('Internal Server Error')
  }
}

const updateStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body

    const order = await Order.findById(orderId)
    if (!order) {
      return res.json({ success: false, message: `Can't find the order` })
    }
    if (order.status === 'Cancelled') {
      return res.json({ success: false, message: `Can't change the order it already Cancelled` })
    }
    order.status = status
    await order.save()
    return res.json({ success: true })
  } catch (error) {
    console.error('error occur while updateStatus', error)
    return res.send('Internal Server Error')
  }
}

const orderCancelled = async (req, res) => {
  try {
    const { orderId } = req.body
    const order = await Order.findById(orderId)
    if (!order) {
      return json({ success: false, message: `Can not find the order` })
    }
    if (order.status === 'Cancelled') {
      return json({ success: false, message: `Order already cancelled` })
    }
    const product = await Product.findById(order.product)
    const productCount = product.stock + order.qty
    product.stock = productCount

    await product.save()
    order.status = 'Cancelled'
    await order.save()
    return res.json({ success: true })

  } catch (error) {
    console.error('error occur while orderCancelled', error)
    return res.send('Internal Server Error')
  }
}

const orderReturn = async (req, res) => {
  try {
    const { orderId, action } = req.body

    var orderData = await Order.findOne({ _id: orderId })
    const userId = orderData.userId
    const productId = orderData.product

    if (action === 'approve') {
      orderData.status = 'Returned'
      const product = await Product.findOne({ _id: productId })

      if (product) {
        product.stock = product.stock + orderData.qty
        await product.save()
      }

      await product.save()


      let totalReturnAmount = orderData.finalAmount - (orderData.discountAmount + orderData.deliveryCharge + orderData.productOrCategoryOfferAmount)

      var wallet = await Wallet.findOne({ userId: userId })

      if (!wallet) {
        wallet = new Wallet({
          userId,
          balance: totalReturnAmount,
          transactions: [
            { type: 'credit', amount: totalReturnAmount, description: `Refund of ${orderId} Order Return.` },
          ],
          date: new Date(),
        })
      } else {
        wallet.balance += totalReturnAmount
        wallet.transactions.push({
          type: 'credit',
          amount: totalReturnAmount,
          description: `Refund of ${orderId} Order Return.`,
          date: new Date(),
        })
      }
      await wallet.save()

      await Transaction.create({
        userId: userId,
        amount: totalReturnAmount,
        transactionType: "credit",
        paymentMethod: "refund",
        paymentGateway: "razorpay",
        status: "completed",
        purpose: "refund",
        description: `Payment refund for order ${orderId} Order Return.`,
        orders: [{ orderId: orderData._id, amount: totalReturnAmount }],
        walletBalanceAfter: wallet.balance
      });


    } else {
      orderData.status = 'Delivered'
    }
    orderData.save()
    return res.json({ success: true })
  } catch (error) {
    console.error('error occur while orderCancelled', error)
    return res.send('Internal Server Error')
  }
}

const loadSalesReport = async (req, res) => {
  try {
    res.render('salesReport')
  } catch (error) {
    console.error('error occur while loadSalesReport', error)
    return res.redirect('/pageerror')
  }
}

const generateSalesReport = async (req, res) => {

  try {

    const fromDate = req.body.startDate ? new Date(req.body.startDate) : new Date();;
    const toDate = req.body.endDate ? new Date(req.body.endDate) : new Date();;

    // Set fromDate to the start of the day (00:00:00)
    if (fromDate && !isNaN(fromDate)) {
      fromDate.setHours(0, 0, 0, 0); // Set to 12:00 AM
    }

    // Set toDate to the end of the day (23:59:59.999)
    if (toDate && !isNaN(toDate)) {
      toDate.setHours(23, 59, 59, 999); // Set to 11:59:59.999 PM
    }


    let paymentMethods = req.body.paymentMethod || [];

    // If paymentMethods contains 'all', don't filter by paymentMethod
    let paymentFilter = {};
    if (!paymentMethods.includes("all") && paymentMethods.length > 0) {
      paymentFilter = { paymentMethod: { $in: paymentMethods } };
    }
    // else paymentFilter stays empty (no filter on paymentMethod)

    const orders = await Order.find({
      createdOn: { $gte: fromDate, $lte: toDate },
      ...paymentFilter
    }).populate('product').sort({ createdOn: -1 });

    // Calculate summary
    const summary = {
      salesCount: orders.length,
      orderAmount: orders.reduce((sum, order) => sum + (order.finalAmount || 0), 0),
      offerAmount: orders.reduce((sum, order) => sum + (order.productOrCategoryOfferAmount || 0), 0),
      discountAmount: orders.reduce((sum, order) => sum + (order.discountAmount || 0), 0),
    };

    res.json({ success: true, orders, summary });
  } catch (error) {
    console.error("Error generating sales report:", error);
    res.json({ success: false, message: "Failed to generate sales report." });
  }
}

module.exports = {
  getorderList,
  getorderdetails,
  updateStatus,
  orderCancelled,
  orderReturn,
  loadSalesReport,
  generateSalesReport
}