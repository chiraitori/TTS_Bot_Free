/**
 * Utility functions for managing settings
 */
const ServerSettings = require('../models/ServerSettings');
const UserSettings = require('../models/UserSettings');

/**
 * Get server settings with defaults
 * @param {string} guildId - Guild ID
 * @returns {Promise<Object>} - Server settings
 */
async function getServerSettings(guildId) {
    try {
        let settings = await ServerSettings.findOne({ guildId });
        if (!settings) {
            // Create default settings if none exist
            settings = await ServerSettings.create({ guildId });
        }
        return settings;
    } catch (error) {
        console.error('Error fetching server settings:', error);
        // Return default settings if database error occurs
        return {
            language: 'en',
            disableUsernames: false,
            disableJoinLeaveMessages: false
        };
    }
}

/**
 * Get user settings or create if not exist
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - User settings
 */
async function getUserSettings(userId) {
    try {
        // First check if settings exist to avoid duplicate key errors
        let settings = await UserSettings.findOne({ userId });
        
        if (!settings) {
            try {
                // Try to create settings, but handle potential race condition
                settings = await UserSettings.create({ 
                    userId,
                    language: null // Default to null (use server language)
                });
            } catch (createError) {
                // If duplicate key error, try to find again
                if (createError.code === 11000) {
                    settings = await UserSettings.findOne({ userId });
                    // If still not found, something else is wrong
                    if (!settings) {
                        throw createError;
                    }
                } else {
                    throw createError;
                }
            }
        }
        return settings;
    } catch (error) {
        console.error('Error fetching user settings:', error);
        // Return default settings if database error occurs
        return {
            language: null // Default to null (use server language)
        };
    }
}

/**
 * Set user language preference
 * @param {string} userId - User ID
 * @param {string} language - Language code
 * @returns {Promise<Object>} - Updated user settings
 */
async function setUserLanguage(userId, language) {
    try {
        const settings = await UserSettings.findOneAndUpdate(
            { userId },
            { 
                userId,
                language,
                lastUpdated: Date.now()
            },
            { upsert: true, new: true }
        );
        return settings;
    } catch (error) {
        console.error('Error updating user language:', error);
        throw error;
    }
}

/**
 * Get the effective language for a user message
 * @param {string} userId - User ID
 * @param {string} guildId - Guild ID
 * @returns {Promise<string>} - Language code to use
 */
async function getEffectiveLanguage(userId, guildId) {
    try {
        // First check if user has a preference
        const userSettings = await getUserSettings(userId);
        
        // If user has a language preference, use it
        if (userSettings.language) {
            return userSettings.language;
        }
        
        // Otherwise use server default
        const serverSettings = await getServerSettings(guildId);
        return serverSettings.language || 'en';
    } catch (error) {
        console.error('Error determining effective language:', error);
        // Fall back to English in case of error
        return 'en';
    }
}

/**
 * Get the response language for a server
 * Used for bot messages in slash commands
 * @param {string} guildId - Guild ID
 * @returns {Promise<string>} - Response language code
 */
async function getResponseLanguage(guildId) {
    try {
        const serverSettings = await getServerSettings(guildId);
        return serverSettings.language || 'en'; // Default to English if not set
    } catch (error) {
        console.error('Error getting response language:', error);
        return 'en'; // Default to English on error
    }
}

module.exports = {
    getServerSettings,
    getUserSettings,
    setUserLanguage,
    getEffectiveLanguage,
    getResponseLanguage
};