const Wishlist = require('../../models/wishlistSchema')
const User = require('../../models/userSchema')
const Product = require('../../models/productSchema')
const HttpStatus = require('../../config/httpStatusCode')
const mongoose = require("mongoose");


const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.user
    const user = await User.findById(userId)

    if (!user) {
      return res.redirect('/login')
    }

    // Fetch wishlist and populate product details
    const wishlist = await Wishlist.findOne({ userId }).populate({
      path: "items.productId",
      populate: {
        path: "category", // this is inside Product
        model: "Category"
      }
    })
    

    if (!wishlist || wishlist.items.length === 0) {
      return res.render('wishlist', { wishlistItems: [], user })
    }

    // Format wishlist items
    const formattedProducts = wishlist.items.map(item => ({
      _id: item.productId._id,
      name: item.productId.name,
      price: item.productId.salePrice,
      brand: item.productId.brand,
      category: item.productId.category,
      photos: item.productId.photos && item.productId.photos.length > 0 ? item.productId.photos : ['/path/to/default-image.jpg'],

    }))
    res.render('wishlist', { wishlistItems: formattedProducts, user })
  } catch (error) {
    console.error('Error loading wishlist:', error)
    res.redirect('/pageNotFound')
  }
}

const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body
    const userId = req.session.user

    const userData = await User.findById(userId)
    if (!userData) {
      return res.json({ status: false, message: "Please log in to add items to your wishlist." })
    }

    const product = await Product.findById(productId)
    if (!product) {
      return res.json({ status: false, message: "Product not found." })
    }

    let wishlist = await Wishlist.findOne({ userId })

    // If no wishlist, create one with an empty items array
    if (!wishlist) {
      wishlist = new Wishlist({ userId, items: [] })
    }

    // Ensure items array exists
    if (!Array.isArray(wishlist.items)) {
      wishlist.items = []
    }

    // Optional: Check if already added
    const alreadyExists = wishlist.items.find(item =>
      item.productId.toString() === productId
    )

    if (alreadyExists) {
      return res.json({ status: false, message: "Product already in wishlist." })
    }

    // Push new item
    wishlist.items.push({ productId })

    await wishlist.save()

    console.log("Product added to wishlist.")
    res.json({ status: true, message: "Product added to wishlist." })

  } catch (error) {
    console.error("Error adding to wishlist:", error)
    res.json({ status: false, message: "An error occurred." })
  }
}



const removeProduct = async (req, res) => {
  try {
    const productId = req.body.productId;
    const user = req.session.user;

    console.log("Received request to delete:", productId);
    console.log("User ID from session:", user);

    if (!productId) {
      return res.status(400).json({ success: false, message: "Product ID missing" });
    }

    if (!user) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const objectIdProductId = new mongoose.Types.ObjectId(productId);

    const result = await Wishlist.updateOne(
      { userId: user._id },
      { $pull: { items: { productId: objectIdProductId } } }
    );

    if (result.modifiedCount === 0) {
      return res.json({ success: false, message: "Product not found in wishlist or already removed" });
    }

    return res.json({ success: true });

  } catch (error) {
    console.error("Error removing item from wishlist:", error);
    res.status(500).json({ success: false, message: "Failed to remove item" });
  }
};


module.exports = {
  loadWishlist,
  addToWishlist,
  removeProduct
} 