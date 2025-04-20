const mongoose = require("mongoose");

// const mongoURI = process.env.MONGODB_URI
const mongoURI = "mongodb://127.0.0.1:27017/SKINDOTFIT" // in case of not connect mongoDB



console.log(mongoURI, '------------------------------------------------')


// Validate the MongoDB connection string
if (!mongoURI) {
    console.error("MongoDB connection string is missing!");
    process.exit(1); // Exit the process with failure
}

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(mongoURI); // Removed deprecated options
        console.log("MongoDB Connected Successfully!");
    } catch (err) {       
        console.error("MongoDB Connection Error:", err.message);
        process.exit(1); // Exit the process with failure
    }
};

module.exports = connectDB;