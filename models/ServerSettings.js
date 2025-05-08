const mongoose = require('mongoose');

const ServerSettingsSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true
    },
    language: {
        type: String,
        default: 'en' // Default to English
    },
    disableUsernames: {
        type: Boolean,
        default: false // By default, usernames are announced
    },
    disableJoinLeaveMessages: {
        type: Boolean,
        default: true // By default, join/leave messages are announced
    },
    enableTranslation: {
        type: Boolean,
        default: false // By default, translation is disabled
    },
    forceServerLanguage: {
        type: Boolean,
        default: false // By default, respect user language preferences
    }
});

module.exports = mongoose.model('ServerSettings', ServerSettingsSchema);