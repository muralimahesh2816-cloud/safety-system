const mongoose = require('mongoose');

const workSchema = new mongoose.Schema({
    workType: String,
    location: String,
    chainage: String,
    workersCount: Number,

    beforeImage: String,   // PPE image
    afterImage: String,    // completion image

    status: {
        type: String,
        default: "Pending"
    },

    createdBy: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Work', workSchema);