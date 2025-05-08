/**
 * Voice connection service for managing Discord voice channel interactions
 */
const { joinVoiceChannel, VoiceConnectionStatus } = require('@discordjs/voice');

/**
 * Join a voice channel and set up connection
 * @param {Object} voiceChannel - Discord voice channel to join
 * @param {string} guildId - Guild ID
 * @param {Object} client - Discord client
 * @returns {Object} - Voice connection
 */
function connectToVoiceChannel(voiceChannel, guildId, client) {
    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
    });
    
    // Store the connection
    client.connections.set(guildId, connection);
    
    // Subscribe to the player
    connection.subscribe(client.player);
    
    // Initialize users in this voice channel
    const userMap = new Map();
    voiceChannel.members.forEach(member => {
        if (!member.user.bot) {
            userMap.set(member.id, member.user.username);
        }
    });
    client.voiceUsers.set(guildId, userMap);
    
    // Set up connection state change listeners
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        console.log(`Disconnected from voice channel in guild ${guildId}`);
        
        // Instead of automatically cleaning up, try to reconnect
        try {
            // If the bot was forcibly disconnected, try to rejoin after a short delay
            setTimeout(async () => {
                try {
                    // Try to get the channel by ID
                    const guild = client.guilds.cache.get(guildId);
                    if (guild) {
                        const channel = guild.channels.cache.get(voiceChannel.id);
                        if (channel) {
                            console.log(`Attempting to reconnect to ${channel.name} in ${guild.name}`);
                            connectToVoiceChannel(channel, guildId, client);
                        }
                    }
                } catch (reconnectError) {
                    console.error('Failed to reconnect:', reconnectError);
                    
                    // Only clean up if reconnection failed
                    client.voiceUsers.delete(guildId);
                    client.connections.delete(guildId);
                }
            }, 5000); // Wait 5 seconds before trying to reconnect
        } catch (error) {
            console.error('Error handling disconnection:', error);
            
            // Clear users when disconnected
            client.voiceUsers.delete(guildId);
            
            // Remove the connection from the collection
            client.connections.delete(guildId);
        }
    });
    
    console.log(`Joined voice channel: ${voiceChannel.name}`);
    return connection;
}

/**
 * Check if the bot is alone and leave if necessary
 * @param {Object} channel - Voice channel
 * @param {string} guildId - Guild ID
 * @param {Object} client - Discord client
 * @returns {boolean} - True if left, false otherwise
 */
function checkAndLeaveEmptyChannel(channel, guildId, client) {
    // Disabled automatic leaving - bot will stay in channels indefinitely
    return false;
    
    /* Original functionality - commented out
    if (!channel) return false;
    
    // Count non-bot members in the voice channel
    const nonBotMembers = channel.members.filter(member => !member.user.bot);
    
    // If there are no human users left (only bots including our bot)
    if (nonBotMembers.size === 0) {
        console.log(`Leaving empty voice channel in guild ${guildId}: No human users left`);
        
        // Get the connection for this guild
        const connection = client.connections.get(guildId);
        if (connection) {
            // Destroy the connection and clean up resources
            connection.destroy();
            client.connections.delete(guildId);
            client.voiceUsers.delete(guildId);
            client.messageQueues.delete(guildId);
            client.isProcessingQueue.delete(guildId);
            return true; // Successfully left channel
        }
    }
    
    return false; // Didn't need to leave channel
    */
}

module.exports = {
    connectToVoiceChannel,
    checkAndLeaveEmptyChannel
};