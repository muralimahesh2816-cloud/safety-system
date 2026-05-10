const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
    type: String, // Incident / Near Miss
    title: String,
    description: String,
    image: String,
    status: {
        type: String,
        default: "Pending"
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Incident', incidentSchema);