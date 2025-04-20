const mongoose = require("mongoose")
const {Schema} = mongoose
const Address = require("./addressSchema")

const couponSchema = new Schema({
  
    name:{
        type:String,
        required:true,
        unique: true
    },
    createdAt:{
        type:Date,
        default:Date.now,
        required:true
    },
    expireOn:{
        type:Date,
        required:true
    },
    offerPrice:{
        type: Number,
        required:true
    },
    minimumPrice:{
        type: Number,
        required:true
    },
    isList:{
        type: Boolean,
        default:true
    },
    createdBy:{
        type: mongoose.Types.ObjectId,
        ref:"User"
    }
    
})


const Coupon = mongoose.model("Coupon",couponSchema)
module.exports = Coupon