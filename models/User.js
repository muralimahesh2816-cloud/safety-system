const mongoose = require("mongoose");

const userSchema =
  new mongoose.Schema({

    name: String,

    email: String,

    mobile: String,

    password: String,

    role: String,

    profileImage: String

  });

module.exports =
  mongoose.model(
    "User",
    userSchema
  );