const Wallet = require('../../models/walletSchema')
const User = require('../../models/userSchema')
const Razorpay = require("razorpay")
const crypto = require('crypto')
require("dotenv").config()
const HttpStatus = require('../../config/httpStatusCode')

const loadwallet = async (req, res) => {
    try {
        const { userId } = req.params
        const user = await User.findById(userId)
        let page = parseInt(req.query.page) || 1
        let limit = 5
        if (page < 1) page = 1
        const skip = (page - 1) * limit
        const wallet = await Wallet.findOne({ userId: userId })
        // console.log('wallet:', wallet)
        if (!wallet) {
            const balance = 0
            const transactions = null
            return res.render('wallet', { balance, user, key_id: process.env.RAZORPAY_KEY_ID, transactions })
        } else {
            const balance = wallet.balance
            const transactions = wallet.transactions
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(skip, skip + limit);
            const totalPages = Math.ceil(wallet.transactions.length / limit);
            return res.render('wallet', { balance, user, transactions, currentPage: page, totalPages, key_id: process.env.RAZORPAY_KEY_ID, limit });
        }
    } catch (error) {
        console.error('error occur while loadWallet', error)
        return res.redirect('/pageNotFound')
    }
}

const addTowallet = async (req, res) => {
    try {
        const { userId, amount } = req.body

        if (!userId || !amount || amount <= 0) {
            return res.status(HttpStatus.BAD_REQUEST).json({ message: 'Invalid input data' })
        }

        let wallet = await Wallet.findOne({ userId: userId })

        if (!wallet) {
            wallet = new Wallet({
                userId,
                balance: amount,
                transactions: [{ type: 'credit', amount, description: 'Wallet top-up' }]
            })
        } else {
            wallet.balance += amount
            wallet.transactions.push({ type: 'credit', amount, description: 'Wallet top-up' })
        }
        await wallet.save()

        await Transaction.create({
            userId: userId,
            amount: amount,
            transactionType: "credit",
            paymentMethod: "online",
            paymentGateway: "razorpay",
            status: "completed",
            purpose: "wallet_add",
            description: `Fund added to the Wallet`,
            walletBalanceAfter: wallet.balance
        });

        res.status(HttpStatus.OK).json({ message: 'Money added successfully', wallet })
    } catch (error) {
        console.error('error occur while loadWallet', error)
        return res.redirect('/pageNotFound')
    }
}

const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
})

const createRazorpayOrder = async (req, res) => {
    try {
        const orderAmount = parseFloat(req.body.amount)
        if (!orderAmount || isNaN(orderAmount) || orderAmount <= 0) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Invalid or missing amount' })
        }

        const order = await razorpayInstance.orders.create({
            amount: Math.round(orderAmount * 100),
            currency: 'INR',
            payment_capture: 1,
        })

        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
        })
    } catch (error) {
        console.error('Error creating Razorpay order:', error)
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message })
    }
}

const razorpayPaymentSuccess = async (req, res) => {
    try {
        const userId = req.session.user
        const { amount, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body

        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex')

        if (generatedSignature !== razorpay_signature) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Invalid payment signature' })
        }

        let wallet = await Wallet.findOne({ userId })
        const amountToAdd = parseFloat(amount)

        if (!wallet) {
            wallet = new Wallet({
                userId,
                balance: amountToAdd,
                transactions: [
                    {
                        type: 'credit',
                        amount: amountToAdd,
                        description: 'Wallet top-up',
                        date: new Date(),
                    },
                ],
            })
        } else {
            wallet.balance += amountToAdd
            wallet.transactions.push({
                type: 'credit',
                amount: amountToAdd,
                description: 'Wallet top-up',
                date: new Date(),
            })
        }

        await wallet.save()

        res.json({ success: true, newBalance: wallet.balance })
    } catch (error) {
        console.error('Error in payment success:', error)
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Server error' })
    }
}

module.exports = {
    loadwallet,
    addTowallet,
    createRazorpayOrder,
    razorpayPaymentSuccess
}


