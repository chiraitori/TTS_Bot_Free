/**
 * English language strings
 */
module.exports = {
    // General responses
    error: "An error occurred. Please try again later.",
    success: "Operation completed successfully.",
    
    // Join command
    join: {
        success: "I've joined your voice channel!",
        userNotInVoiceChannel: "You need to join a voice channel first!",
        alreadyConnected: "I'm already connected to a voice channel!",
        inUseElsewhere: "I'm currently in use in <#{0}>. Please wait until they are finished.",
        connecting: "Connecting to {0}...",
        failed: "Failed to connect to the voice channel. Please try again.",
        noPermission: "I don't have permission to join your voice channel.",
        error: "Couldn't join voice channel. Please try again."
    },
    
    // Leave command
    leave: {
        success: "Left the voice channel!",
        notConnected: "I'm not connected to any voice channel!",
        error: "Couldn't leave the voice channel."
    },
    
    // Say command
    say: {
        success: "Message sent!",
        notConnected: "I need to be in a voice channel first! Use /join",
        emptyMessage: "Please provide a message to say.",
        error: "Couldn't send TTS message."
    },
    
    // MyLanguage command
    myLanguage: {
        success: "Your language has been set to {0}!",
        reset: "Your language preference has been reset. You will use the server default language.",
        error: "Couldn't set your language preference."
    },
    
    // Settings command
    settings: {
        current: "**Current Server Settings**\nLanguage: {0}\nUsernames disabled: {1}\nJoin/leave notifications disabled: {2}",
        updated: "Settings have been updated!",
        language: {
            changed: "Server language has been set to {0}!",
            invalid: "Invalid language code. Available languages: {0}"
        },
        joinLeaveMessages: {
            enabled: "Join/leave notifications have been enabled.",
            disabled: "Join/leave notifications have been disabled."
        },
        usernames: {
            enabled: "Usernames will be announced.",
            disabled: "Usernames will no longer be announced."
        },
        error: "Couldn't update settings."
    },
    
    // Help command
    help: {
        title: "TTS Bot Commands",
        join: "Join your voice channel",
        leave: "Leave the voice channel",
        say: "Have the bot say something",
        myLanguage: "Set your personal TTS language",
        settings: "Change server settings",
        help: "Show this help message",
        footer: "Type / to see available commands"
    },

    // Voice events
    voiceEvents: {
        userJoined: "{0} joined the channel",
        userLeft: "{0} left the channel"
    }
};