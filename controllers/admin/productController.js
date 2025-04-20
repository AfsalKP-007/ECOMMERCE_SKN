const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");

const User = require("../../models/userSchema");
const mongoose = require("mongoose");

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ status: true });
    res.render("product-add", {
      cat: category,
    });
  } catch (error) {
    res.redirect("/pageerror");
  }
};

const addProducts = async (req, res) => {
  try {
    // Extract product data from request body
    const { name, description, brand, category, regularPrice, salePrice, stock } = req.body;

    // Ensure required fields are provided
    if (!name || !description || !brand || !category || !regularPrice) {
      return res.status(400).json({ success: false, message: "All required fields must be provided." });
    }

    // Check if product with the same name already exists
    const productExists = await Product.findOne({ name });
    if (productExists) {
      return res.status(400).json({ success: false, message: "Product already exists, try another name." });
    }

    // Find the category in the database
    const foundCategory = await Category.findOne({ name: category });
    if (!foundCategory) {
      return res.status(400).json({ success: false, message: "Category not found." });
    }

    // Set up the upload directory
    const uploadDir = path.join(__dirname, "../../public/uploads/product-images");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Process images (both cropped images & file uploads)
    const imageFilenames = [];

    for (let i = 1; i <= 4; i++) {
      const croppedImageData = req.body[`croppedImage${i}`];

      if (croppedImageData && croppedImageData.startsWith("data:image")) {
        // Convert base64 image to buffer
        const base64Data = croppedImageData.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");

        // Generate filename & save the image
        const filename = `${Date.now()}-cropped-image-${i}.webp`;
        const filepath = path.join(uploadDir, filename);

        await sharp(imageBuffer).webp({ quality: 80 }).toFile(filepath);
        imageFilenames.push(`uploads/product-images/${filename}`);

      } else if (req.files && req.files[`image${i}`]) {
        const file = req.files[`image${i}`][0];
        const filename = `${Date.now()}-${file.originalname.replace(/\s/g, "")}.webp`;
        const filepath = path.join(uploadDir, filename);

        await sharp(file.buffer)
          .resize(800, 800, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(filepath);

        imageFilenames.push(`uploads/product-images/${filename}`);
      }
    }

    // Ensure at least one image is uploaded
    if (imageFilenames.length === 0) {
      return res.status(400).json({ success: false, message: "Please upload at least one product image." });
    }

    // Create and save the new product
    const newProduct = new Product({
      name,
      description,
      brand,
      category: foundCategory._id,
      regularPrice,
      salePrice,
      stock,
      photos: imageFilenames,
      status: "Available",
    });

    await newProduct.save();
    return res.status(200).json({ success: true, message: "Product added successfully." });

  } catch (error) {
    console.error("Error saving product:", error);
    return res.status(500).json({ success: false, message: "Error saving product." });
  }
};

const saveImage = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }

    // Generate unique filename
    const filename = Date.now() + '-' + file.originalname.replace(/\s/g, "");
    const filepath = path.join(__dirname, "../../public/uploads/product-images", filename);

    // Resize & convert to WebP
    await sharp(file.buffer)
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(filepath);

    return res.status(200).json({ success: true, message: "Image saved successfully", filename });
  } catch (error) {
    console.error("Error saving image:", error);
    return res.status(500).json({ success: false, message: "Error saving image" });
  }
};


  const changeImage = async (req, res) => {
    try {
      
        const { productId, index } = req.body;

        console.log( " WORKING ________________" )

        if (!req.file) {
            return res.status(400).json({ success: false, message: "No image uploaded" });
        }

        console.log("Received image for product:", productId, "Index:", index);

        // Update in Database (Assuming MongoDB)
        const updatedProduct = await Product.findByIdAndUpdate(
            productId, 
            { $set: { [`photos.${index}`]: req.file.filename } },
            { new: true }
        );

        res.json({ success: true, product: updatedProduct });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }

  }


  const calculateEffectivePrice = async (product) => {
    const category = await Category.findById(product.category);
    const categoryOffer = category ? category.categoryOffer || 0 : 0;
    const productOffer = product.productOffer || 0;
  
    const effectiveOffer = Math.max(categoryOffer, productOffer);
    const effectivePrice = product.regularPrice * (1 - effectiveOffer / 100);
  
    return Math.round(effectivePrice * 100) / 100;
  };
  
  
const getAllProducts = async (req, res) => {

  try {
    const search = req.query.search || "";
    const categoryFilter = req.query.category || "";
    const page = parseInt(req.query.page) || 1;

    const filter = req.query.filter || ""

    const limit = 19;
    

    const query = {
      $or: [
        { name: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { brand: { $regex: new RegExp(".*" + search + ".*", "i") } }
      ]
    };

    if (categoryFilter && mongoose.Types.ObjectId.isValid(categoryFilter)) {
      query.category = categoryFilter 
    }

    // // Apply additional filters for deleted or blocked products
    if (filter === "deleted") { 
      query.isDeleted = true;
    } else if (filter === "blocked") {
      query.isBlocked = true;
    }

    const productData = await Product.find(query)
      .sort({ createdAt: 1 }) // Newest first
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("category")
      .exec();


    const count = await Product.countDocuments(query);
    const totalPages = Math.ceil(count / limit);
    const category = await Category.find({ isListed: true });

    const productsWithEffectivePrices = await Promise.all(productData.map(async (product) => {
      const effectivePrice = await calculateEffectivePrice(product);
      return {
        ...product.toObject(),
        salePrice: effectivePrice
      };
    }));

    if (category.length > 0) {
      res.render("products", {
        data: productsWithEffectivePrices,
        currentPage: page,
        totalPages: totalPages,
        cat: category,
        selectedCategory: categoryFilter
      });
    } else {
      res.render("admin-error");
    }
  } catch (error) {
    console.error("Error fetching products:", error);
    res.render("admin-error");
  }
};



const blockProduct = async (req, res) => {
  const productId = req.query.id;

  if (!productId) {
      return res.status(400).json({ status: false, message: 'Product ID is required' });
  }

  try {
      const result = await Product.updateOne({ _id: productId }, { $set: { isBlocked: true } });

      if (result.modifiedCount === 0) {
          return res.status(404).json({ status: false, message: 'Product not found or already deleted' });
      }

      else {
        return res.json({ success: true, message: "Product Blocked successfully" });
      }


  } catch (err) {
      console.error(err);
      res.redirect("/pageerror")  }
};

const unblockProduct = async (req, res) => {
  const productId = req.query.id;


  if (!productId) {
      return res.status(400).json({ status: false, message: 'Product ID is required' });
  }

  try {
      const result = await Product.updateOne({ _id: productId }, { $set: { isBlocked: false } });

      if (result.modifiedCount === 0) {
          return res.status(404).json({ status: false, message: 'Product not found or already deleted' });
      }

      else {
        return res.json({ success: true, message: "Product Unblocked successfully" });
      }


  } catch (err) {
      console.error(err);
      res.status(500).json({ status: false, message: 'Server Error' });
  };
}

const deleteProduct = async (req, res) => {
  const productId = req.query.id;

  if (!productId) {
      return res.status(400).json({ status: false, message: 'Product ID is required' });
  }

  try {
      const result = await Product.updateOne({ _id: productId }, { $set: { isDeleted: true } });

      if (result.modifiedCount === 0) {
          return res.status(404).json({ status: false, message: 'Product not found or already deleted' });
      }

      else {
        return res.json({ success: true, message: "Product Deleted successfully" });
      }


  } catch (err) {
      console.error(err);
      res.status(500).json({ status: false, message: 'Server Error' });
  }
};


const getEditProduct = async (req, res) => {
  try {
    const id = req.query.id
    const product = await Product.findOne({ _id: id }).populate("category")
    const categories = await Category.find({})

    if (!product) {
      return res.status(404).send("Product not found")
    }

    res.render("product-edit", {
      product: product,
      cat: categories,
    })
  } catch (error) {
    console.error("Error in getEdit Product:", error)
    res.redirect("/pageerror")
  }
}



const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer, imageIndex } = req.body;
    const product = await Product.findById(productIdToServer);

    if (!product) {
      return res.status(404).json({ status: false, message: "Product not found" });
    }

    
    product.photos.splice(imageIndex, 1);
    await product.save();

    const imagePath = path.join(__dirname, "../../public", imageNameToServer);

    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
      console.log(`Image ${imageNameToServer} deleted successfully`);
    } else {
      console.log(`Image ${imageNameToServer} not found`);
    }

    res.json({ status: true, message: "Image deleted successfully" });
  } catch (error) {
    console.error("Error in deleteSingleImage:", error);
    res.status(500).json({ status: false, message: "An error occurred while deleting the image" });
  }
};


const editProduct = async (req, res) => {
 
  try {

    const id = req.params.id

    const {
      name,
      description,
      regularPrice,
      salePrice,
      stock,
      brand,
      category,      

    } = req.body

    const existingProduct = await Product.findOne({
      name: name,
      _id: { $ne: id },
    })

    if (existingProduct) {
      return res
        .status(400)
        .json({ success: false, message: "Product with this name already exists. Please try another name." })
    }

    const updateFields = {
      name,
      description,
      regularPrice,
      salePrice,
      stock,
      brand,
      category
    }

    const product = await Product.findById(id)
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" })
    }

    
    for (let i = 1; i <= 4; i++) {
      const croppedImageData = req.body[`croppedImage${i}`];
      
      if (croppedImageData && croppedImageData.startsWith('data:image')) {
        
        const base64Data = croppedImageData.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
       
        const filename = Date.now() + "-" + `cropped-image-${i}` + ".webp";
        const filepath = path.join(__dirname, "../../public/uploads/product-images", filename);

      
        await sharp(imageBuffer)
          .webp({ quality: 80 })
          .toFile(filepath);

        const imagePath = `uploads/product-images/${filename}`;

        
        if (product.photos[i - 1]) {
          product.photos[i - 1] = imagePath;
        } else {
          product.photos.push(imagePath);
        }
      } else if (req.files && req.files[`image${i}`]) {
        
        const file = req.files[`image${i}`][0];
        const filename = Date.now() + "-" + file.originalname.replace(/\s/g, "") + ".webp";
        const filepath = path.join(__dirname, "../../public/uploads/product-images", filename);

        await sharp(file.buffer)
          .resize(800, 800, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(filepath);

        const imagePath = `uploads/product-images/${filename}`;

        if (product.photos[i - 1]) {
          product.photos[i - 1] = imagePath;
        } else {
          product.photos.push(imagePath);
        }
      }
    }

    Object.assign(product, updateFields);
    await product.save();

    res.json({ success: true, message: "Product updated successfully" });
  } catch (error) {
    console.error("Error in editProduct:", error);
    res.status(500).json({ success: false, message: "An error occurred while updating the product" });
  }
};


module.exports = {
  getProductAddPage,
  saveImage,
  changeImage,
  addProducts,
  getAllProducts,
  calculateEffectivePrice,
  blockProduct,
  unblockProduct,
  getEditProduct,
  deleteSingleImage,
  deleteProduct,
  editProduct
};
