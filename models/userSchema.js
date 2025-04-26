    const mongoose = require("mongoose");
    const { Schema } = mongoose;

    const userSchema = new Schema({
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true,
            unique: true
        },
        phone: {
            type: String,
            required: false,
            unique: true,
            sparse: true,
            default: null
        },
        googleId: {
            type: String,
            // unique: true,
            sparse: true,
        },
        username: {
            type: String,
            required: false
        },
        password: {
            type: String,
            required: false
        },
        isBlocked: {
            type: Boolean,
            default: false,
            required: true
        },
        isAdmin: {
            type: Boolean,
            default: false,
            required: true
        },
        photo: {
            type: [String],
        },
        wallet: {
            type: Number,
            default: 0
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        referalCode: {
            type: String,
            default: null
        }
    });

    const User = mongoose.model("User", userSchema);
    module.exports = User;
