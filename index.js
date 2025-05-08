// Require necessary modules
require('dotenv').config();
const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
const { createAudioPlayer, NoSubscriberBehavior } = require('@discordjs/voice');
const mongoose = require('mongoose');

// Import database models
const ServerSettings = require('./models/ServerSettings');

// Import services and utilities
const { processMessageText } = require('./utils/textProcessor');
const { checkAndCleanupDiskSpace, cleanupOnExit } = require('./utils/fileManager');
const { getServerSettings, getEffectiveLanguage, getResponseLanguage } = require('./utils/settingsHelper');
const { processTTS } = require('./services/ttsService');
const voiceService = require('./services/voiceService');
const { processMessageQueue, enqueueMessage, enqueueSystemMessage } = require('./services/queueService');
const { getText } = require('./utils/languageManager');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tts_bot')
.then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('MongoDB connection error:', err);
    console.log('Continuing without database connection - using default settings');
});

// Create a new Discord client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Create audio player
const player = createAudioPlayer({
    behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause,
    },
});

// Create collections to store state
client.connections = new Collection();
client.voiceUsers = new Collection(); // Track users in voice channels
client.messageQueues = new Collection(); // Message queues for each guild
client.isProcessingQueue = new Collection(); // Track if we're currently processing the queue
client.lastSpeaker = new Map(); // Track last speaker to avoid repeating usernames

// Store the player in client for access from commands
client.player = player;

// Add methods to client for easier access throughout the application
client.processTTS = async function(text, guildId, fromQueue = false, langCode = 'en') {
    return processTTS(text, guildId, client, fromQueue, langCode);
};

// Add voice channel joining function to client
client.joinVoiceChannel = function(voiceChannel, guildId) {
    return voiceService.connectToVoiceChannel(voiceChannel, guildId, client);
};

// Add leave empty channel function to client
client.checkAndLeaveEmptyChannel = function(channel, guildId) {
    return voiceService.checkAndLeaveEmptyChannel(channel, guildId, client);
};

// Add queue processing function to client
client.processMessageQueue = function(guildId) {
    return processMessageQueue(guildId, client, getServerSettings);
};

// When the client is ready, register slash commands
client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log('Slash Command TTS Bot is ready!');
    
    // Register commands via the handler
    try {
        const registerCommands = require('./handlers/commandHandler');
        await registerCommands(client);
    } catch (err) {
        console.error('Error registering commands:', err);
    }
    
    // Do initial cleanup at startup
    console.log('Performing initial disk cleanup...');
    await checkAndCleanupDiskSpace();
    
    // Schedule regular cleanup checks
    setInterval(checkAndCleanupDiskSpace, 30 * 60 * 1000); // Check every 30 minutes
});

// Handle message events for auto TTS in voice channels
client.on(Events.MessageCreate, async (message) => {
    // Ignore messages from bots to prevent loops or if it starts with a slash
    if (message.author.bot || message.content.startsWith('/')) return;
    
    try {
        // Check if we're connected to this guild
        let connection = client.connections.get(message.guild?.id);
        if (!connection) return; // Only read messages if already connected
        
        // Check if the message author is in a voice channel
        const member = message.guild.members.cache.get(message.author.id);
        const voiceChannel = member?.voice?.channel;
        
        // If user isn't in a voice channel or not in the same channel as the bot, skip
        if (!voiceChannel || voiceChannel.id !== connection.joinConfig.channelId) return;
        
        // Check if the message is from the same channel as the voice channel
        if (message.channel.id !== voiceChannel.id) return;
        
        // Process message text to handle links and mentions
        const processedText = processMessageText(message);
        
        // Skip empty messages
        if (!processedText || !processedText.text) return;
        
        // Check if this user was the last speaker
        const lastSpeakerId = client.lastSpeaker.get(message.guild.id);
        const isSameAsPreviousSpeaker = (lastSpeakerId === message.author.id);
        
        // Update the last speaker
        client.lastSpeaker.set(message.guild.id, message.author.id);
        
        // Use the member's display name in the server (nickname if set, otherwise username)
        const displayName = member?.displayName || message.author.username;
        
        // Add message to queue with display name format
        enqueueMessage(
            message.guild.id,
            processedText.text,
            displayName, // Use the display name of the member in this server
            message.author.id,
            !isSameAsPreviousSpeaker && !processedText.isExpression, // Only include "said" if not the same user and not an expression
            client,
            getServerSettings,
            true // Flag to use "said" format
        );
        
    } catch (error) {
        console.error('Error processing auto TTS request:', error);
    }
});

// Handle voice state updates to track users joining/leaving voice channels
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    // Handle the bot being kicked or moved
    if (oldState.member.id === client.user.id && oldState.channel && !newState.channel) {
        console.log('Bot was removed from voice channel');
        
        // Clean up resources when bot is kicked - no notification needed
        const guildId = oldState.guild.id;
        client.connections.delete(guildId);
        client.voiceUsers.delete(guildId);
        client.messageQueues.delete(guildId); // Clear message queue when disconnected
        client.isProcessingQueue.delete(guildId);
    }
    
    // Ignore other bot voice state changes
    if (oldState.member.user.bot || newState.member.user.bot) return;
    
    // Get guild ID for server settings
    const guildId = newState.guild?.id || oldState.guild?.id;
    if (!guildId) return;
    
    // Fetch server settings
    const serverSettings = await getServerSettings(guildId);
    const responseLang = serverSettings.language || 'en';
    
    // Skip join/leave announcements if disabled in settings
    if (serverSettings.disableJoinLeaveMessages) {
        // Still track users in voice channels, but don't announce
        if (newState.channel) {
            const connection = client.connections.get(guildId);
            if (connection && connection.joinConfig.channelId === newState.channelId) {
                const guildUsers = client.voiceUsers.get(guildId) || new Map();
                guildUsers.set(newState.member.id, newState.member.user.username);
                client.voiceUsers.set(guildId, guildUsers);
            }
        }
        
        if (oldState.channel) {
            const connection = client.connections.get(guildId);
            if (connection && connection.joinConfig.channelId === oldState.channelId) {
                const guildUsers = client.voiceUsers.get(guildId);
                if (guildUsers) {
                    guildUsers.delete(oldState.member.id);
                }
                
                // REMOVED: No longer check if the bot should leave the channel
                // client.checkAndLeaveEmptyChannel(oldState.channel, guildId);
            }
        }
        return;
    }
    
    // Handle user joining a voice channel where the bot is present
    if (newState.channel) {
        const connection = client.connections.get(newState.guild.id);
        
        // If the bot is in this voice channel
        if (connection && connection.joinConfig.channelId === newState.channelId) {
            // Add user to the voice users map
            const guildUsers = client.voiceUsers.get(newState.guild.id) || new Map();
            guildUsers.set(newState.member.id, newState.member.user.username);
            client.voiceUsers.set(newState.guild.id, guildUsers);
            
            // Announce user joining if they weren't just moving between channels
            if (!oldState.channel) {
                // Get localized text for user joined
                const joinMessage = getText('voiceEvents.userJoined', responseLang, [newState.member.user.username]);
                
                // Add join announcement with high priority
                enqueueSystemMessage(
                    newState.guild.id,
                    joinMessage,
                    client,
                    getServerSettings
                );
            }
        }
    }
    
    // Handle user leaving a voice channel where the bot is present
    if (oldState.channel) {
        const connection = client.connections.get(oldState.guild.id);
        
        // If the bot is in this voice channel
        if (connection && connection.joinConfig.channelId === oldState.channelId) {
            // Remove user from the voice users map
            const guildUsers = client.voiceUsers.get(oldState.guild.id);
            if (guildUsers) {
                guildUsers.delete(oldState.member.id);
                
                // Announce user leaving if they're not just moving between channels
                if (!newState.channel) {
                    // Get localized text for user left
                    const leaveMessage = getText('voiceEvents.userLeft', responseLang, [oldState.member.user.username]);
                    
                    // Add leave announcement with high priority
                    enqueueSystemMessage(
                        oldState.guild.id,
                        leaveMessage,
                        client,
                        getServerSettings
                    );
                }
                
                // REMOVED: No longer check if the bot should leave the channel
                // client.checkAndLeaveEmptyChannel(oldState.channel, oldState.guild.id);
            }
        }
    }
});

// Handle interactions (slash commands)
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    
    try {
        await command.execute(interaction, client);
    } catch (error) {
        console.error(`Error executing command ${interaction.commandName}:`, error);
        
        try {
            // Get server's response language if possible
            let responseLang = 'en';
            try {
                if (interaction.guildId) {
                    responseLang = await getResponseLanguage(interaction.guildId);
                }
            } catch (langError) {
                console.error('Error getting response language:', langError);
            }
            
            const replyContent = { 
                content: getText('error', responseLang), 
                ephemeral: true 
            };
            
            // Check if the interaction is still valid and hasn't been replied to
            if (interaction.deferred) {
                await interaction.editReply(replyContent).catch(err => {
                    // Silently catch errors from the edit reply, already logged above
                    console.log(`Could not edit reply for ${interaction.commandName}: ${err.code}`);
                });
            } else if (!interaction.replied) {
                // Only attempt to reply if we haven't already
                await interaction.reply(replyContent).catch(err => {
                    // Silently catch errors from the reply, already logged above
                    console.log(`Could not reply to ${interaction.commandName}: ${err.code}`);
                });
            }
            // If already replied, do nothing
        } catch (replyError) {
            console.error('Error sending error response:', replyError);
        }
    }
});

// Clean up any lingering files on exit
process.on('exit', cleanupOnExit);

// Handle errors
client.on('error', console.error);
player.on('error', console.error);

// Login with token from .env file
client.login(process.env.DISCORD_TOKEN);