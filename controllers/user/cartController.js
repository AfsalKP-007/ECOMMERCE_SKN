const User = require('../../models/userSchema')
const Product = require('../../models/productSchema')
const Cart = require('../../models/cartSchema')
const Address = require('../../models/addressSchema')
const Coupon = require('../../models/couponSchema')
const Wishlist = require('../../models/wishlistSchema')
const HttpStatus = require('../../config/httpStatusCode')





const calculateEffectivePrice = async (product) => {

  const category = await Category.findById(product.category);
  const categoryOffer = category ? category.offer || 0 : 0;
  const productOffer = product.productOffer || 0;

  const effectiveOffer = Math.max(categoryOffer, productOffer);
  const effectivePrice = product.salePrice * (1 - effectiveOffer / 100);

  return Math.round(effectivePrice * 100) / 100;
};

const addToCart = async (req, res) => {
  try {

    const { productId } = req.body
    const userId = req.session.user
    if (!userId) {
      return res.json({ success: false, message: "Please log in to add items to your cart." })
    }
    const product = await Product.findById(productId).populate('category');
    if (!product) {
      return res.json({ success: false, message: "Product not found." })
    }
    if (product.stock <= 0) {
      return res.json({ success: false, message: "Product out of stock." })
    }
    if (product.isBlocked) {
      return res.json({ success: false, message: "Blocked This Product" })
    }
    if (product.isDeleted) {
      return res.json({ success: false, message: "Deleted This Product" })
    }

    if (product.category && product.category.status === false) {
      return res.json({ success: false, message: "Product category is inactive." });
    }

    let cart = await Cart.findOne({ userId })
    if (!cart) {
      cart = new Cart({ userId, items: [] })
    }


    const shippingCost = 0
    const deliveryCharge = 0

    const existingItem = cart.items.find(item =>
      item.productId.toString() === productId
    )


    // Calculate the effective price using the provided calculateEffectivePrice function
    const priceAfterDiscount = await calculateEffectivePrice(product);

    if (existingItem) {
      existingItem.qty += 1

      existingItem.priceAfterDiscount = (existingItem.qty * priceAfterDiscount)

      if (existingItem.qty > product.stock) {
        return res.json({ success: false, message: "Cannot add more items than available stock." })
      }

      // New Code
      existingItem.totalPrice = (existingItem.qty * existingItem.price)

    } else {

      cart.items.push({
        productId,
        qty: 1,
        price: product.salePrice,
        shipping: shippingCost,
        deliveryCharge: deliveryCharge,
        totalPrice: (product.salePrice),
        priceAfterDiscount: priceAfterDiscount
      })

    }

    await cart.save()

    await Wishlist.updateOne(
      { userId },
      { $pull: { items: { productId } } }
    )
    res.json({ success: true, message: "Product added to cart." })
  } catch (error) {
    console.error("Error adding to cart:", error)
    res.json({ success: false, message: "An error occurred." })
  }
}


const loadCart = async (req, res) => {
  try {
    const userId = req.session.user
    if (!userId) {
      return res.json({ success: false })
    }

    const user = await User.findById(userId)
    const cart = await Cart.findOne({ userId }).populate('items.productId')

    if (!cart || cart.items.length === 0) {
      return res.render('cart', {
        cartItems: [],
        user
      })
    }

    const filteredCartItems = cart.items.filter(item => {
      return item.productId && !item.productId.isBlocked && item.productId.stock > 0
    })

    const subtotal = filteredCartItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0)
    const subTotalPriceAfterDiscount = filteredCartItems.reduce((sum, item) => sum + (item.priceAfterDiscount || 0), 0)

    const totalPriceAfterDiscount = subtotal - subTotalPriceAfterDiscount

    let shipping = 0
    let deliveryCharge = subTotalPriceAfterDiscount <= 2000 ? 50 : 0;

    let total = (subtotal + shipping + deliveryCharge) - totalPriceAfterDiscount

    res.render('cart', {
      cartItems: filteredCartItems,
      user,
      subtotal,
      deliveryCharge,
      shipping,
      totalPriceAfterDiscount,
      total
    })

  } catch (error) {
    console.error('Error occurred while loading the cart:', error)
    res.redirect('/pageNotFound')
  }
}


const removeCartItem = async (req, res) => {
  try {
    const userId = req.session.user
    const { productId } = req.body
    if (!userId) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' })
    }
    const cart = await Cart.findOne({ userId })
    if (!cart) {
      return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: 'Cart not found' })
    }
    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId
    )
    await cart.save()
    return res.json({ success: true })
  } catch (error) {
    console.error('Error removing item from cart:', error)
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to remove item' })
  }
}

const updateCartQuantity = async (req, res) => {

  try {
    const userId = req.session.user
    const { productId, newQuantity } = req.body
    if (!userId) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' })
    }
    const cart = await Cart.findOne({ userId })
    if (!cart) {
      return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: 'Cart not found' })
    }
    const item = cart.items.find(i => i.productId.toString() === productId)
    if (!item) {
      return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: 'Item not in cart' })
    }
    const qty = parseInt(newQuantity, 10)
    item.qty = qty

    if (!isNaN(item.qty) && !isNaN(item.totalPrice)) {
      item.totalPrice = parseFloat(item.qty * item.price);
    } else {
      console.warn('Invalid qty or price for item:', item);
      item.totalPrice = 0;
    }


    // Calculate the effective price using the provided calculateEffectivePrice function
    const product = await Product.findById(productId)
    const priceAfterDiscount = await calculateEffectivePrice(product);

    if (!isNaN(item.qty) && !isNaN(item.priceAfterDiscount)) {
      item.priceAfterDiscount = parseFloat(item.qty * priceAfterDiscount)
    }

    await cart.save()
    return res.json({ success: true })
  } catch (error) {
    console.error('Error updating cart quantity:', error)
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Server error' })
  }
}

const loadCheckOut = async (req, res) => {
  try {
    const userId = req.session.user
    const user = await User.findById(userId)
    const cart = await Cart.findOne({ userId }).populate('items.productId')

    const coupons = await Coupon.find({ expireOn: { $gt: new Date() } })

    if (!cart || cart.items.length === 0) {
      return res.redirect('/shop')
    }

    const cartItems = []
    const outOfStockItems = []

    cart.items.forEach(item => {
      if (
        item.productId &&
        !item.productId.isBlocked &&
        item.productId.stock >= item.qty
      ) {
        cartItems.push(item)
      } else {
        outOfStockItems.push({
          name: item.productId ? item.productId.name : "Unknown Product",
          requestedQty: item.qty,
          availableStock: item.productId ? item.productId.stock : 0,
          shortBy: item.productId ? item.qty - item.productId.stock : item.qty
        })
      }
    })

    if (outOfStockItems.length) {
      const productList = outOfStockItems.map(item =>
        `${item.name} (Only ${item.availableStock} in stock, you requested ${item.requestedQty})`
      ).join('\n')

      // Change This to response ////////////////////////////////////////////////////////////////////
      console.log("Some Items Stock is not available")

      return res.redirect('/cart');
    }



    const subTotal = cartItems.reduce((sum, item) => sum + item.totalPrice, 0)
    const subTotalPriceAfterDiscount = cartItems.reduce((sum, item) => sum + (item.priceAfterDiscount || 0), 0)

    const totalPriceAfterDiscount = subTotal - subTotalPriceAfterDiscount


    let shipping = 0


    let deliveryCharge = subTotalPriceAfterDiscount <= 2000 ? 50 : 0;

    const total = (subTotal + shipping + deliveryCharge) - totalPriceAfterDiscount


    const addressData = await Address.findOne({ userId })
    const add = addressData ? addressData.address : []

    res.render('checkOut', {
      user,
      cartItems,
      subTotal,
      deliveryCharge,
      shipping,
      total,
      totalPriceAfterDiscount,
      add,
      coupons
    })
  } catch (error) {
    console.error('Error occurred while loading checkout:', error)
    return res.redirect('/pageNotFound')
  }
}


const loadCheckOutCoupon = async (req, res) => {
  try {
    const userId = req.session.user
    const user = await User.findById(userId)
    const Coupons = await Coupon.find({ expireOn: { $gte: new Date() } })
    console.log('Coupons:', Coupons)
    res.render('showCoupons', { coupons: Coupons, user })
  } catch (error) {
    console.error('Error occur on loadCheckOutCoupon', error)
    res.redirect('/pageNotFound')
  }
}










module.exports = {
  addToCart,
  loadCart,
  removeCartItem,
  updateCartQuantity,
  loadCheckOut,
  loadCheckOutCoupon
}