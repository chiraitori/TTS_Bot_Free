/**
 * Utility functions for keeping voice connections alive
 */
const { AudioPlayerStatus, createAudioResource } = require('@discordjs/voice');
const { Readable } = require('stream');
const { bufferToStream } = require('./fileManager');

// Create a silent audio buffer (1 second of silence)
const SILENCE_FRAME = Buffer.from([0xF8, 0xFF, 0xFE]);

/**
 * Creates a silent audio resource that can be played
 * to maintain an active connection
 * @returns {AudioResource} - Silent audio resource
 */
function createSilentAudioResource() {
    // Create a stream of silence frames
    const buffer = Buffer.concat([SILENCE_FRAME, SILENCE_FRAME, SILENCE_FRAME, SILENCE_FRAME]);
    const stream = bufferToStream(buffer);
    
    // Create an audio resource from the stream
    return createAudioResource(stream, {
        inlineVolume: true,
    });
}

/**
 * Start a keep-alive mechanism for voice connections
 * @param {Object} client - Discord client
 */
function startKeepAliveSystem(client) {
    // Check every 4 minutes - just before Discord's 5-minute inactivity timeout
    setInterval(() => {
        // For each active connection
        client.connections.forEach((connection, guildId) => {
            try {
                // Skip if the player is currently playing something
                if (client.player.state.status !== AudioPlayerStatus.Idle) {
                    return;
                }

                // Check if there are users in the channel (besides the bot)
                const voiceChannel = connection.joinConfig.channelId;
                const guild = client.guilds.cache.get(guildId);
                if (!guild) return;
                
                const channel = guild.channels.cache.get(voiceChannel);
                if (!channel) return;

                // Only play silence when there are people in the channel
                const nonBotMembers = channel.members.filter(member => !member.user.bot);
                if (nonBotMembers.size > 0) {
                    console.log(`Playing silent audio to maintain connection in ${guild.name}`);
                    const resource = createSilentAudioResource();
                    
                    // Set volume to minimal to avoid any potential noise
                    if (resource.volume) {
                        resource.volume.setVolume(0.01);
                    }
                    
                    // Play the silent audio resource
                    client.player.play(resource);
                }
            } catch (error) {
                console.error(`Error in keepAlive for guild ${guildId}:`, error);
            }
        });
    }, 4 * 60 * 1000); // Every 4 minutes
    
    console.log('Keep-alive system started');
}

module.exports = {
    startKeepAliveSystem
};
