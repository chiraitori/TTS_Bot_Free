const mongoose = require('mongoose');

const UserSettingsSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    language: {
        type: String,
        default: null // Default to null, which means use server default
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('UserSettings', UserSettingsSchema);