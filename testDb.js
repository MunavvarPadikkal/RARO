require("dotenv").config();
const connectDB = require("./config/db");
const mongoose = require("mongoose");
const User = require("./models/userSchema");
const bcrypt = require("bcrypt");

connectDB().then(async () => {
  const admin = await User.findOne({ isAdmin: true });
  console.log("Admin found:", admin);
  process.exit();
}).catch(console.log);
