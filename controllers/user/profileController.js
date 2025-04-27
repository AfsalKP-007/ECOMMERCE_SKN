const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
// const securePassword = require("../../utils/securePassword");
const env = require("dotenv").config();
const session = require("express-session")


const multer = require("multer")
const sharp = require("sharp")
const fs = require("fs")
const path = require("path");
const { log } = require("console");




function generateOtp() {
    const digits = "1234567890"
    let otp = "";
    for (let i = 0; i < 6; i++) {
        otp += digits[Math.floor(Math.random() * 10)]
    }
    return otp
}

const sendVerificationEmail = async (email, otp) => {
    try {

        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            }
        })

        const mailOption = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Your OTP for password reset",
            text: `Your OTP is ${otp}`,
            html: `<b><h4>Your OTP : ${otp}</h4><br></b>`,

        }

        const info = await transporter.sendMail(mailOption);
        console.log("Email sent:", info.messageId)

        return true;

    } catch (error) {

        console.error("error sending email", error);
        return false

    }
}


const securePassword = async (password) => {
    try {

        const passwordHash = await bcrypt.hash(password, 10);
        return passwordHash

    } catch (error) {


    }
}



const getForgotPassPage = async (req, res) => {
    try {

        res.render("forgot-password");

    } catch (error) {

        res.redirect("/pageNotFound")

    }
}

const forgotEmailValid = async (req, res) => {
    try {

        const { email } = req.body;
        const findUser = await User.findOne({ email: email });
        if (findUser) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email, otp);
            if (emailSent) {
                req.session.userOtp = otp;
                req.session.email = email;
                res.render("forgotPass");

                console.log("Forgot Email OTP: ", otp)
            } else {
                res.json({ success: false, message: "Failed to send OTP. PLease try again" })
            }

        } else {
            res.render("forgot-password", {
                message: "User with this email does not exist"
            })
        }

    } catch (error) {

        res.redirec("/pageNotFound")

    }
}

const verifyForgotPassOtp = async (req, res) => {
    try {

        const enteredOtp = req.body.otp;
        if (enteredOtp === req.session.userOtp) {
            req.session.resetAllowed = true;
            res.json({ success: true, redirectUrl: "/reset-password" })
        } else {
            res.json({ success: false, message: "OTP not matching" })
        }

    } catch (error) {

        res.status(500).json({ success: false, message: "An error occured please try again" })

    }
}

const getResetPassPage = async (req, res) => {
    try {

        res.render("reset-password")

    } catch (error) {

        res.redirect("/pageNotFound")

    }
}

const resendOtp = async (req, res) => {
    try {

        const otp = generateOtp();
        req.session.userOtp = otp;
        const email = req.session.email;
        console.log("Resending otp to email", email);
        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log("Resend Otp: ", otp);
            res.status(200).json({ success: true, message: "Resend OTP Successful" })
        }

    } catch (error) {

        console.error("Error in rend otp", error);
        res.status(500).json({ success: false, message: "Internal server errro" })

    }
}

const postNewPassword = async (req, res) => {
    try {

        const { newPass1, newPass2 } = req.body;
        const email = req.session.email;

        if (newPass1 === newPass2) {

            const passwordHash = await securePassword(newPass1);
            await User.updateOne(
                { email: email },
                { $set: { password: passwordHash } }
            );


            req.session.userOtp = null;
            req.session.email = null;
            req.session.resetAllowed = null;

            res.json({ success: true, message: "Password updated successfully" });

        } else {
            res.json({ success: false, message: "Password do not match" });
        }

    } catch (error) {
        res.redirect("/pageNotFound")
    }
}


const loadProfile = async (req, res) => {
    try {

        const userId = req.session.user;
        const userData = await User.findById(userId);

        res.render("profile", { user: userData })

    } catch (error) {

        console.error('Error:', error)
        res.redirect("/pageNotFound")

    }
}



const updateDefaultAddress = async (req, res) => {
    try {
        const { addressId } = req.body;

        // Validate input
        if (!addressId) {
            return res.status(400).json({ success: false, message: 'Address ID is required' });
        }

        const userData = req.session.user;

        // Find the user to get user ID
        const user = await User.findById(userData._id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Find the Address document(s) for the user
        const addressDocs = await Address.find({ userId: userData._id });
        if (!addressDocs || addressDocs.length === 0) {
            return res.status(400).json({ success: false, message: 'No addresses found' });
        }


        // Check if the provided address_id exists in any of the address arrays
        // let addressExists = false;
        // for (const doc of addressDocs) {
        //     if (doc.address.some(addr => addr._id.toString() === address_id.toString())) {
        //         addressExists = true;
        //         break;
        //     }
        // }
        // if (!addressExists) {
        //     return res.status(404).json({ success: false, message: 'Address not found' });
        // }

        // Step 1: Set defaultAddress to false for all 
        await Address.updateMany(
            { userId: userData._id },
            { $set: { 'address.$[].defaultAddress': false } }
        );

        // Step 2: Set defaultAddress to true 
        const result = await Address.updateOne(
            { userId: userData._id, 'address._id': addressId },
            { $set: { 'address.$.defaultAddress': true } }
        );

        if (result.modifiedCount === 0) {
            return res.status(400).json({ success: false, message: 'Failed to update default address' });
        }

        res.json({ success: true, message: 'Default address updated successfully' });
    } catch (error) {
        console.error('Error updating default address:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};



const loadEditProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const userData = await User.findById(userId);
        console.log('User Data:', userData); // Add this line
        if (!userData) {
            console.log('User not found');
            return res.status(404).render('pageNotFound', { userData: null });
        }
        res.render('editProfile', { userData });
    } catch (error) {
        console.error('Error loading edit profile:', error);
        res.status(500).render('error', { message: 'Something went wrong' });
    }
};


const changeEmail = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        res.render("change-email", {
            user: userData
        })

    } catch (error) {

        res.redirect("/pageNotFound")

    }
}


const changeEmailValid = async (req, res) => {
    try {

        const { email } = req.body;
        const userExist = await User.findOne({ email });
        if (userExist) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email, otp)
            if (emailSent) {
                req.session.userOtp = otp;
                req.session.userdata = req.body;
                req.session.email = email;
                res.render("change-email-otp");
                console.log(`Email Sent : ${email}, Otp: ${otp}`)
            } else {
                res.json("email-error")
            }
        } else {
            res.render("change-email", {
                message: "User with email not exist"
            })
        }

    } catch (error) {

        res.redirect("/pageNotFound")

    }
}

const verifyEmailOtp = async (req, res) => {
    try {

        const enteredOtp = req.body.otp;
        if (enteredOtp === req.session.userOtp) {
            req.session.userData = req.body.userData;
            res.render("newEmail", {
                userData: req.session.userData,
            })
        } else {
            res.render("change-email-otp", {
                message: "OTP not Matching",
                userData: req.session.userData,
            })
        }

    } catch (error) {

        res.redirect("/pageNotFound")

    }
}

const updateEmail = async (req, res) => {

    try {


        const newEmail = req.body.newEmail;
        const userId = req.session.user;

        // Simple Email Validation using regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            return res.json({ success: false, message: "Invalid email format" });
        }

        // Check if the email already exists
        const existingUser = await User.findOne({ email: newEmail });
        if (existingUser) {
            return res.json({ success: false, message: "Email already in use" });
        }


        // Update the user's email
        await User.findByIdAndUpdate(userId, {
            email: newEmail,
        });

        res.json({ success: true, message: "Email updated successfully" });

    } catch (error) {

        res.redirect("/pageNotFound")

    }
}


const EditProfile = async (req, res) => {
    try {
        const { username, phone, gender, email } = req.body;
        const userId = req.params.userId;
        const userData = await User.findById(userId);

        if (!userData) {
            console.log('user not found in editProfile');
            return res.redirect('/pageNotFound');
        }

        const updatedUser = await User.findByIdAndUpdate(userId, {
            username,
            phone,
            gender
        }, { new: true, runValidators: true });

        // Render the edit profile page with updated data
        res.render('user/editProfile', { userData: updatedUser });
    } catch (error) {
        console.error('error occur while updating user profile', error);
        res.redirect('/pageNotFound');
    }
};


const updateProfile = async (req, res) => {
    try {

        const userId = req.session.user;
        const { name, username, phone } = req.body;

        // Validate phone number
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid 10-digit phone number'
            });
        }

        // Check if username is already taken
        if (username) {
            const existingUser = await User.findOne({
                username,
                _id: { $ne: userId }
            });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Username is already taken. Please choose a different one.'
                });
            }
        }

        // Update user profile
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { name, username, phone },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while updating your profile'
        });
    }
};





const changePassword = async (req, res) => {

    try {

        const { currentPassword, newPassword, confirmPassword } = req.body;
        const userId = req.session.user;


        if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long and contain both letters and numbers.' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Passwords do not match.' });
        }


        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // Check if the current password is correct
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, error: 'current_password_incorrect', message: 'Current password is incorrect.' });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the user's password
        user.password = hashedPassword;
        await user.save();

        return res.status(200).json({ success: true, message: 'Password updated Successfully' });

    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ success: false, message: 'An error occurred while changing the password.' });
    }
};






const loadAddressPage = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const addressData = await Address.findOne({ userId: userId })

        res.render("addresses", {
            user: userData,
            userAddress: addressData,

        })

    } catch (error) {

        console.error("Error in Address loading", error);
        res.redirect("/pageNotFound");

    }
}

const loadAddAddress = async (req, res) => {
    try {

        const user = req.session.user;
        const userData = await User.findById(user);
        res.render("addAddress", {

            theUser: user,
            user: userData
        })

    } catch (error) {

        res.redirect("/pageNotFound")

    }
}

const updateAddress = async (req, res) => {
    try {

        const userId = req.session.user;
        const userData = await User.findOne({ _id: userId })
        const { addressType, name, country, city, landMark, state, streetAddress, pincode, phone, email, altPhone } = req.body;

        const userAddress = await Address.findOne({ userId: userData._id });

        if (!userAddress) {
            const newAddress = new Address({
                userId: userData,
                address: [{ addressType, name, country, city, landMark, state, streetAddress, pincode, phone, email, altPhone }]

            });
            await newAddress.save();
        } else {
            userAddress.address.push({ addressType, name, country, city, landMark, state, streetAddress, pincode, phone, email, altPhone })
            await userAddress.save();
        }

        res.redirect("/address")

    } catch (error) {

        console.error("Error adding address", error)

        res.redirect("/pageNotFound")

    }
}

const editAddress = async (req, res) => {
    try {

        const addressId = req.query.id;
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const currAddress = await Address.findOne({
            "address._id": addressId,

        });
        if (!currAddress) {
            return res.redirect("/pageNotFound")
        }

        const addressData = currAddress.address.find((item) => {
            return item._id.toString() === addressId.toString();

        })

        if (!addressData) {
            return res.redirect("/pageNotFound")
        }

        res.render("editAddress", {
            address: addressData,
            user: userData
        })

    } catch (error) {

        console.error("Error in edit Address", error)
        res.redirect("/pageNotFound")

    }
}


const postEditAddress = async (req, res) => {
    try {

        const data = req.body;
        const addressId = req.query.id;
        const user = req.session.user;
        const findAddress = await Address.findOne({
            "address._id": addressId
        });
        if (!findAddress) {
            res.redirect("/pageNotFound")
        }
        await Address.updateOne(
            { "address._id": addressId },
            {
                $set: {
                    "address.$": {
                        _id: addressId,
                        addressType: data.addressType,
                        name: data.name,
                        country: data.country,
                        city: data.city,
                        landMark: data.landMark,
                        state: data.state,
                        streetAddress: data.streetAddress,
                        pincode: data.pincode,
                        phone: data.phone,
                        email: data.email,
                        altPhone: data.altPhone
                    }
                }
            }
        )

        res.redirect("/address")

    } catch (error) {

        console.error("Error in editing address", error)
        res.redirect("/pageNotFound")

    }
}

const deleteAddress = async (req, res) => {
    try {

        const addressId = req.query.id;
        const findAddress = await Address.findOne({ "address._id": addressId })

        if (!findAddress) {
            return res.status(404).send("Address Not Found")
        }

        await Address.updateOne(
            {
                "address._id": addressId
            },
            {
                $pull: {
                    address: {
                        _id: addressId,
                    }
                }
            })

        res.redirect("/address")

    } catch (error) {

        console.error("Error in deleting in address", error)
        res.redirect("/pageNotFound")

    }
}



const addProfile = async (req, res) => {
    try {
        const userId = req.params.id
        const imagePath = `/uploads/${req.file.filename}`


        console.log("UserID:", userId);
        console.log("File data:", req.file);


        await User.findByIdAndUpdate(userId, { photo: imagePath })

        res.json({ success: true, imagePath })
    } catch (error) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Error uploading image' })
    }
}







module.exports = {
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    loadProfile,
    loadAddressPage,
    loadAddAddress,
    updateAddress,
    editAddress,
    postEditAddress,
    loadEditProfile,
    addProfile,
    EditProfile,
    deleteAddress,
    updateProfile,
    changeEmail,
    changeEmailValid,
    verifyEmailOtp,
    updateEmail,
    changePassword,
    updateDefaultAddress
}