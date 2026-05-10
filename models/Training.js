const mongoose = require("mongoose");

const trainingSchema = new mongoose.Schema({

  title: String,

  description: String,

  category: String,

  banner: String,

  video: String,

  createdAt: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model(
  "Training",
  trainingSchema
);