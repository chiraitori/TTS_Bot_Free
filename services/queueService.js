/**
 * Message queue service for processing TTS messages
 */
const { processTTS } = require('./ttsService');
const { getEffectiveLanguage } = require('../utils/settingsHelper');

/**
 * Process the next message in the queue for a guild
 * @param {string} guildId - Guild ID
 * @param {Object} client - Discord client
 * @param {Function} getServerSettings - Function to get server settings
 * @returns {Promise<void>}
 */
async function processMessageQueue(guildId, client, getServerSettings) {
    // Check if we're already processing this guild's queue
    if (client.isProcessingQueue.get(guildId)) {
        return;
    }
    
    // Get the queue for this guild
    const messageQueue = client.messageQueues.get(guildId);
    if (!messageQueue || messageQueue.length === 0) {
        return;
    }
    
    try {
        // Mark that we're processing the queue
        client.isProcessingQueue.set(guildId, true);
        
        // Get the next message from the queue
        const messageData = messageQueue.shift();
        
        // Get server settings from database
        const serverSettings = await getServerSettings(guildId);
        
        // Format the text to include username if requested and not disabled in server settings
        let textToSpeak = messageData.text;
        
        if (messageData.includeUsername && 
            !serverSettings.disableUsernames && 
            messageData.username && 
            messageData.username !== "System") {
            
            // Use "[Name] said <text>" format if specified
            if (messageData.useSaidFormat) {
                textToSpeak = `${messageData.username} said, ${textToSpeak}`;
            } else {
                // Otherwise use the original format with comma
                textToSpeak = `${messageData.username} said, ${textToSpeak}`;
            }
        }
        
        // Create a promise that resolves when audio finishes playing
        const playbackPromise = new Promise((resolve) => {
            // Set up a one-time listener for when all chunks are done
            const completeHandler = () => {
                resolve();
            };
            
            // Store the handler on the player so we can access it later
            client.player.completeHandler = completeHandler;
            client.player.once('queue:complete', completeHandler);
        });
        
        // Get the language based on user preference or server default
        let langCode;
        
        if (messageData.userId && messageData.userId !== "System") {
            // Use user's preferred language if available
            langCode = await getEffectiveLanguage(messageData.userId, guildId);
        } else {
            // For system messages or if no user ID, use server default
            langCode = serverSettings.language || 'en';
        }
        
        // Process the TTS - this will handle the audio playback
        await processTTS(textToSpeak, guildId, client, true, langCode);
        
        // Wait for playback to finish
        await playbackPromise;
        
        // Short delay between messages
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Mark that we're done processing
        client.isProcessingQueue.set(guildId, false);
        
        // Process next message if any
        processMessageQueue(guildId, client, getServerSettings);
        
    } catch (error) {
        console.error('Error processing message queue:', error);
        // Mark that we're done processing in case of error
        client.isProcessingQueue.set(guildId, false);
        // Try to process the next message after a delay
        setTimeout(() => {
            processMessageQueue(guildId, client, getServerSettings);
        }, 1000);
    }
}

/**
 * Add a message to the queue and start processing if needed
 * @param {string} guildId - Guild ID
 * @param {string} text - Message text
 * @param {string} username - Username or server name of sender
 * @param {string} userId - User ID of sender
 * @param {boolean} includeUsername - Whether to announce username
 * @param {Object} client - Discord client
 * @param {Function} getServerSettings - Function to get server settings
 * @param {boolean} useSaidFormat - Whether to use "[name] said" format
 */
function enqueueMessage(guildId, text, username, userId, includeUsername, client, getServerSettings, useSaidFormat = false) {
    // Initialize queue for this guild if it doesn't exist
    if (!client.messageQueues.has(guildId)) {
        client.messageQueues.set(guildId, []);
    }
    
    // Add message to queue
    client.messageQueues.get(guildId).push({
        text,
        username,
        userId,
        includeUsername,
        useSaidFormat, // Store format preference
        timestamp: Date.now()
    });
    
    // Start processing the queue if not already doing so
    processMessageQueue(guildId, client, getServerSettings);
}

/**
 * Add a system message with high priority
 * @param {string} guildId - Guild ID
 * @param {string} text - Message text
 * @param {Object} client - Discord client
 * @param {Function} getServerSettings - Function to get server settings
 */
function enqueueSystemMessage(guildId, text, client, getServerSettings) {
    // Initialize queue for this guild if it doesn't exist
    if (!client.messageQueues.has(guildId)) {
        client.messageQueues.set(guildId, []);
    }
    
    // Add system message to the start of the queue with high priority
    client.messageQueues.get(guildId).unshift({
        text,
        username: "System",
        userId: "System",
        includeUsername: false,
        timestamp: Date.now()
    });
    
    // Start processing the queue
    processMessageQueue(guildId, client, getServerSettings);
}

module.exports = {
    processMessageQueue,
    enqueueMessage,
    enqueueSystemMessage
};