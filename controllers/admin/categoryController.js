Category = require("../../models/categorySchema");

const categories = async (req, res) => {

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const searchQuery = req.query.search ? req.query.search.trim() : "";
    const filterStatus = req.query.filter || "all";

    let filter = {};

    if (searchQuery) {
      filter.name = { $regex: new RegExp(searchQuery, "i") };
    }


    // Status Filtering
    if (filterStatus === "active") {
      filter.status = true;
    } else if (filterStatus === "deleted") {
      filter.status = false;
    }


    const categoryData = await Category.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);


    if (req.xhr) {
      return res.render("partials/category-list", { cat: categoryData });
    }

    const totalCategories = await Category.countDocuments(filter);
    const totalPages = Math.ceil(totalCategories / limit);

    res.render("category", {
      cat: categoryData,
      currentPage: page,
      totalPages: totalPages,
      totalCategories: totalCategories,
      searchQuery: searchQuery,
      filterStatus: filterStatus, // Pass filter status to frontend
    });

  } catch (error) {
    console.error(error);
    res.redirect("/pageerror");
  }
};

const addCategory = async (req, res) => {
  try {
    const { name, description, offer } = req.body;

    const existingCategory = await Category.findOne({ name: new RegExp(`^${name}$`, "i") });

    if (existingCategory) {
      return res
        .status(400)
        .json({ status: "duplicate", error: "Category Name already exists" });
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ status: "nameError", error: "Category name is required" });
    }

    // Check if Category Offer is greater than 50
    if (offer !== undefined && (offer < 0 || offer > 50)) {
      return res.status(400).json({ status: "offerError", error: "Offer value must be between 0 and 50" });
    }
    const newCategory = new Category({
      name,
      description,
      offer
    });

    await newCategory.save();
    return res.json({ success: true, message: "Category added successfully" });

  } catch (error) {
    return res.status(500).json({ status: error });
  }
};

const editCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;


    let offer = parseInt(req.body.offer)

    if (isNaN(offer))
      offer = 0

    // Check if the category name already exists (excluding the current one)
    const existingCategory = await Category.findOne({ name: new RegExp(`^${name}$`, "i"), _id: { $ne: id } });

    if (existingCategory) {
      return res
        .status(400)
        .json({ status: "duplicate", error: "Category Name already exists" });
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ status: "nameError", error: "Category name is required" });
    }

    // Check if Category Offer is greater than 50
    if (offer !== undefined && (offer < 0 || offer > 50)) {
      return res.status(400).json({ status: "offerError", error: "Offer value must be between 0 and 50" });
    }

    // Update the category
    await Category.findByIdAndUpdate(id, { name, description, offer });
    return res.json({ success: true, message: "Category Updated successfully" });

  } catch (error) {
    res.status(500).json({ success: false, status: error });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;

    // Update status to false instead of deleting
    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId, { status: false }, { new: true } // Returns updated category
    );

    if (!updatedCategory) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    res.json({ success: true, message: "Category Deleted successfully" });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  categories,
  addCategory,
  editCategory,
  deleteCategory,
};
