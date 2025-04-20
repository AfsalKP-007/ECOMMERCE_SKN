const mongoose = require("mongoose")
const {Schema} = mongoose
const Address = require("./addressSchema")

const bannerSchema = new Schema({
  
    title:{
        type:String,
        required:true
    },
    photo:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    link:{
        type:String
    },
    startDate:{
        type:Date,
        required:true
    },
    endtDate:{
        type:Date,
        required:true
    },
    createdBy:{
        type: mongoose.Types.ObjectId,
        ref:"User"
    }
    
})


const Banner = mongoose.model("Banner",bannerSchema)
module.exports = Banner