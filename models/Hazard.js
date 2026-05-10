const mongoose = require('mongoose');

const hazardSchema = new mongoose.Schema({
  date: String,
  plaza: String,
  location: String,
  reportedBy: String,
  category: String,
  action: String,
  beforeImage: String,
  afterImage: String,
  status: { type: String, default: "Open" }
});

module.exports = mongoose.model('Hazard', hazardSchema);