// Require necessary modules
require('dotenv').config();
const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior,
    VoiceConnectionStatus
} = require('@discordjs/voice');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const googleTTS = require('google-tts-api');
const { promisify } = require('util');
const { Readable } = require('stream');
const mongoose = require('mongoose');

// Import database models
const ServerSettings = require('./models/ServerSettings');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tts_bot', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('MongoDB connection error:', err);
    console.log('Continuing without database connection - using default settings');
});

// Function to get server settings with defaults
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

// Function to check disk space and clean temp folder if needed
async function checkAndCleanupDiskSpace() {
    const tmpDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tmpDir)){
        return;
    }
    
    try {
        // Get disk space info - requires Unix-like OS (Linux/macOS)
        let lowDiskSpace = false;
        try {
            const stats = fs.statfsSync(tmpDir);
            const freeSpace = stats.bfree * stats.bsize;
            const totalSpace = stats.blocks * stats.bsize;
            const freePercentage = (freeSpace / totalSpace) * 100;
            
            // Log disk space status every hour
            if (Date.now() % 3600000 < 10000) { // Log approximately once per hour
                console.log(`Disk space: ${(freeSpace / 1024 / 1024).toFixed(2)}MB free (${freePercentage.toFixed(2)}%)`);
            }
            
            // If less than 500MB or 10% free, consider it low disk space
            lowDiskSpace = freeSpace < 500 * 1024 * 1024 || freePercentage < 10;
        } catch (err) {
            // If we can't check disk space, assume we should clean up anyway
            lowDiskSpace = true;
        }
        
        // If disk space is low or we're just doing routine cleanup
        if (lowDiskSpace || Date.now() % 86400000 < 10000) { // Clean daily or when space is low
            console.log('Performing cleanup of temp directory...');
            
            // Get all files in the temp directory
            const files = fs.readdirSync(tmpDir);
            let filesDeleted = 0;
            let bytesFreed = 0;
            
            for (const file of files) {
                // Skip non-mp3 files and directories
                if (!file.endsWith('.mp3')) continue;
                
                const filePath = path.join(tmpDir, file);
                try {
                    // Check if file is currently being used
                    if (activeAudioFiles.has(filePath)) {
                        continue;
                    }
                    
                    // Check file age - delete files older than 6 hours
                    const stats = fs.statSync(filePath);
                    const fileAgeMins = (Date.now() - stats.mtime) / 60000;
                    if (fileAgeMins > 360) { // 6 hours
                        bytesFreed += stats.size;
                        fs.unlinkSync(filePath);
                        filesDeleted++;
                    }
                } catch (err) {
                    console.error(`Error processing file ${file}:`, err.message);
                }
            }
            
            if (filesDeleted > 0) {
                console.log(`Cleanup complete: Removed ${filesDeleted} files (${(bytesFreed / 1024 / 1024).toFixed(2)} MB)`);
            } else {
                console.log('No files eligible for cleanup');
            }
        }
    } catch (err) {
        console.error('Error during disk space check/cleanup:', err);
    }
}

// Utility function to create a readable stream from a buffer
function bufferToStream(buffer) {
    const readable = new Readable();
    readable._read = () => {}; // _read is required but we'll push manually
    readable.push(buffer);
    readable.push(null);
    return readable;
}

// Create a new Discord client with necessary intents - added back MessageContent intent for auto-reading
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

// Create collections to store active voice connections, track audio files, and users in voice channels
client.connections = new Collection();
const activeAudioFiles = new Set();
client.voiceUsers = new Collection(); // Track users in voice channels

// Message queues for each guild - NEW
client.messageQueues = new Collection(); 
client.isProcessingQueue = new Collection(); // Track if we're currently processing the queue

// Store the player in client for access from commands
client.player = player;

// Function to split text into chunks of maximum 200 characters
function splitTextIntoChunks(text, maxLength = 200) {
    if (text.length <= maxLength) {
        return [text];
    }

    const chunks = [];
    
    // Split the text by sentences
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    let currentChunk = '';
    
    for (const sentence of sentences) {
        // If a single sentence is longer than the maxLength, split it by words
        if (sentence.length > maxLength) {
            const words = sentence.split(' ');
            let tempChunk = '';
            
            for (const word of words) {
                if ((tempChunk + ' ' + word).length <= maxLength) {
                    tempChunk += (tempChunk ? ' ' : '') + word;
                } else {
                    if (tempChunk) chunks.push(tempChunk);
                    tempChunk = word;
                }
            }
            
            if (tempChunk) {
                chunks.push(tempChunk);
            }
        } 
        // Check if adding this sentence would exceed the limit
        else if ((currentChunk + ' ' + sentence).length <= maxLength) {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
        } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = sentence;
        }
    }
    
    if (currentChunk) {
        chunks.push(currentChunk);
    }
    
    return chunks;
}

// Function to safely remove a file
function safeDeleteFile(filePath) {
    if (!filePath) {
        console.warn("Attempted to delete a file with undefined path");
        return;
    }
    
    // Check if the file exists before trying to delete
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            activeAudioFiles.delete(filePath);
        } catch (err) {
            console.error(`Error deleting file ${filePath}:`, err.message);
            
            // If file is busy/locked, schedule deletion for later
            if (err.code === 'EBUSY' || err.code === 'EPERM') {
                console.log(`File ${filePath} is busy, scheduling deletion for later`);
                setTimeout(() => {
                    try {
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                            activeAudioFiles.delete(filePath);
                            console.log(`Successfully deleted delayed file: ${filePath}`);
                        }
                    } catch (retryErr) {
                        console.error(`Failed retry deletion of ${filePath}:`, retryErr.message);
                    }
                }, 5000); // Try again after 5 seconds
            }
        }
    } else {
        // File doesn't exist but we should clean up our tracking
        activeAudioFiles.delete(filePath);
    }
}

// Function to process TTS for a chunk and return a promise
async function processTTSChunk(text, tmpDir, langCode = 'en') {
    try {
        // Get the audio URL from Google TTS API
        const audioURL = googleTTS.getAudioUrl(text, {
            lang: langCode,
            slow: false,
            host: 'https://translate.google.com',
        });
        
        // Download the audio file
        const audioResponse = await fetch(audioURL);
        const audioBuffer = await audioResponse.buffer();
        
        // Always use in-memory mode to avoid file system operations
        return {
            buffer: audioBuffer,
            inMemory: true
        };
    } catch (error) {
        console.error('Error processing TTS chunk:', error);
        return null;
    }
}

// Add the TTS processing function to the client for use in commands
client.processTTS = async function(text, guildId, fromQueue = false, langCode = 'en') {
    // Create temporary directory if it doesn't exist
    const tmpDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tmpDir)){
        fs.mkdirSync(tmpDir);
    }
    
    // Split the text into chunks
    const chunks = splitTextIntoChunks(text);
    
    // Array to store audio chunks
    const audioChunks = [];
    
    // Process all chunks and get their audio data
    for (const chunk of chunks) {
        const result = await processTTSChunk(chunk, tmpDir, langCode);
        if (result) {
            audioChunks.push(result);
        }
    }
    
    // Skip if no audio chunks were created
    if (audioChunks.length === 0) {
        if (fromQueue) {
            // If called from queue and no chunks, emit completion event anyway
            process.nextTick(() => player.emit('queue:complete'));
        }
        return;
    }
    
    // Ensure the connection still exists and is valid
    const connection = client.connections.get(guildId);
    if (!connection) {
        // Clean up any disk-based files if connection doesn't exist
        audioChunks.forEach(chunk => {
            if (!chunk.inMemory && chunk.path) {
                safeDeleteFile(chunk.path);
            }
        });
        
        if (fromQueue) {
            // If called from queue and connection is gone, emit completion event
            process.nextTick(() => player.emit('queue:complete'));
        }
        return;
    }
    
    // Make sure the player is subscribed to the connection
    connection.subscribe(player);
    
    // Set up a variable to track the current chunk being played
    let currentChunkIndex = 0;
    let lastPlayedChunk = null;
    
    // Remove previous idle event listeners to avoid memory leaks
    player.removeAllListeners(AudioPlayerStatus.Idle);
    
    // Function to play the next chunk
    const playNextChunk = () => {
        // Delete the previous chunk that was just played (if it was file-based)
        if (lastPlayedChunk && !lastPlayedChunk.inMemory && lastPlayedChunk.path) {
            const pathToDelete = lastPlayedChunk.path; // Store path in local variable
            // Use setTimeout to allow the file to be fully processed before deletion
            setTimeout(() => {
                safeDeleteFile(pathToDelete);
            }, 100); // Short delay to ensure playback is complete
            lastPlayedChunk = null; // Clear lastPlayedChunk AFTER capturing the path
        }
        
        if (currentChunkIndex < audioChunks.length) {
            try {
                const currentChunk = audioChunks[currentChunkIndex];
                if (!currentChunk) {
                    console.error(`Missing audio chunk at index ${currentChunkIndex}`);
                    currentChunkIndex++;
                    playNextChunk();
                    return;
                }
                
                let resource;
                if (currentChunk.inMemory) {
                    // Create resource from memory buffer
                    resource = createAudioResource(bufferToStream(currentChunk.buffer), { 
                        inlineVolume: true 
                    });
                } else {
                    // Check if file exists before playing
                    if (!fs.existsSync(currentChunk.path)) {
                        console.error(`Audio file not found: ${currentChunk.path}`);
                        currentChunkIndex++;
                        playNextChunk();
                        return;
                    }
                    // Create resource from file
                    resource = createAudioResource(currentChunk.path, { 
                        inlineVolume: true 
                    });
                }
                
                // Set volume to 100%
                if (resource.volume) {
                    resource.volume.setVolume(1);
                }
                
                // Store reference to the chunk we're about to play
                lastPlayedChunk = currentChunk;
                
                // Play the audio
                player.play(resource);
                currentChunkIndex++;
            } catch (error) {
                console.error('Error playing audio chunk:', error);
                currentChunkIndex++;
                playNextChunk();
            }
        } else {
            // All chunks have been played, clean up the last one
            if (lastPlayedChunk && !lastPlayedChunk.inMemory && lastPlayedChunk.path) {
                const finalPathToDelete = lastPlayedChunk.path; // Store path before clearing reference
                setTimeout(() => {
                    safeDeleteFile(finalPathToDelete);
                }, 100);
                lastPlayedChunk = null; // Clear reference
            }
            
            // Remove the event listener to avoid memory leaks
            player.removeAllListeners(AudioPlayerStatus.Idle);
            
            // Emit an event to signal that playback is complete
            if (fromQueue) {
                // Use a short delay to ensure all audio has been processed
                setTimeout(() => player.emit('queue:complete'), 150);
            }
        }
    };
    
    // Listen for the end of audio playback to play the next chunk
    player.on(AudioPlayerStatus.Idle, playNextChunk);
    
    // Start playing the first chunk
    playNextChunk();
};

// Process the next message in the queue for a specific guild
client.processMessageQueue = async function(guildId) {
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
        
        // Only add username if:
        // 1. The message data indicates it should include username
        // 2. Server settings don't disable usernames
        // 3. A username actually exists
        // 4. It's not a system message (to avoid "System says...")
        if (messageData.includeUsername && 
            !serverSettings.disableUsernames && 
            messageData.username && 
            messageData.username !== "System") {
            textToSpeak = `${messageData.username}, ${textToSpeak}`;
        }
        
        // Create a promise that resolves when audio finishes playing
        const playbackPromise = new Promise((resolve) => {
            // Set up a one-time listener for when all chunks are done
            const completeHandler = () => {
                resolve();
            };
            
            // Store the handler on the player so we can access it later
            player.completeHandler = completeHandler;
            player.once('queue:complete', completeHandler);
        });
        
        // Get the language from server settings
        const langCode = serverSettings.language || 'en';
        
        // Process the TTS - this will handle the audio playback
        await client.processTTS(textToSpeak, guildId, true, langCode);
        
        // Wait for playback to finish
        await playbackPromise;
        
        // Short delay between messages
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Mark that we're done processing
        client.isProcessingQueue.set(guildId, false);
        
        // Process next message if any
        client.processMessageQueue(guildId);
        
    } catch (error) {
        console.error('Error processing message queue:', error);
        // Mark that we're done processing in case of error
        client.isProcessingQueue.set(guildId, false);
        // Try to process the next message after a delay
        setTimeout(() => {
            client.processMessageQueue(guildId);
        }, 1000);
    }
};

// Add a voice channel joining function to the client
client.joinVoiceChannel = function(voiceChannel, guildId) {
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
    connection.subscribe(player);
    
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
        
        // Clear users when disconnected
        client.voiceUsers.delete(guildId);
        
        // Remove the connection from the collection
        client.connections.delete(guildId);
    });
    
    console.log(`Joined voice channel: ${voiceChannel.name}`);
    return connection;
};

// Function to check if the bot is alone in a voice channel and leave if so
client.checkAndLeaveEmptyChannel = function(channel, guildId) {
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
};

// Function to process message text - replace links with "a link" and mentions with @username
function processMessageText(message) {
    let text = message.content;
    
    // Replace URLs with "a link"
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    text = text.replace(urlRegex, "a link");
    
    // Replace Discord mentions with @username
    message.mentions.users.forEach(user => {
        const mention = `<@${user.id}>`;
        const replacement = `@${user.username}`;
        text = text.replace(mention, replacement);
    });
    
    // Replace role mentions
    message.mentions.roles.forEach(role => {
        const mention = `<@&${role.id}>`;
        const replacement = `@${role.name}`;
        text = text.replace(mention, replacement);
    });
    
    // Replace channel mentions
    message.mentions.channels.forEach(channel => {
        const mention = `<#${channel.id}>`;
        const replacement = `#${channel.name}`;
        text = text.replace(mention, replacement);
    });
    
    return text;
}

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
        // Only read messages from the text channel that corresponds to the voice channel the bot is in
        if (message.channel.id !== voiceChannel.id) return;
        
        // Process message text to handle links and mentions
        const textToSpeak = processMessageText(message);
        
        // Skip empty messages
        if (!textToSpeak) return;
        
        // Initialize queue for this guild if it doesn't exist
        if (!client.messageQueues.has(message.guild.id)) {
            client.messageQueues.set(message.guild.id, []);
        }
        
        // Add message to queue
        client.messageQueues.get(message.guild.id).push({
            text: textToSpeak,
            username: message.author.username,
            includeUsername: true, // Say username before the message
            timestamp: Date.now()
        });
        
        // Start processing the queue if not already doing so
        client.processMessageQueue(message.guild.id);
        
    } catch (error) {
        console.error('Error processing auto TTS request:', error);
    }
});

// Handle voice state updates to track users joining/leaving voice channels
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    // Handle the bot being kicked or moved
    if (oldState.member.id === client.user.id && oldState.channel && !newState.channel) {
        console.log('Bot was removed from voice channel');
        
        // Get the channel where the bot was last active
        const channelId = oldState.channel.id;
        const guildId = oldState.guild.id;
        
        // Clean up resources when bot is kicked - no notification needed
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
                
                // Check if the bot should leave the channel using the dedicated function
                client.checkAndLeaveEmptyChannel(oldState.channel, guildId);
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
                // Initialize queue for this guild if it doesn't exist
                if (!client.messageQueues.has(newState.guild.id)) {
                    client.messageQueues.set(newState.guild.id, []);
                }
                
                // Add join announcement to message queue with high priority
                client.messageQueues.get(newState.guild.id).unshift({
                    text: `${newState.member.user.username} joined the channel`,
                    username: "System",
                    includeUsername: false,
                    timestamp: Date.now()
                });
                
                // Start processing the queue
                client.processMessageQueue(newState.guild.id);
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
                    // Initialize queue for this guild if it doesn't exist
                    if (!client.messageQueues.has(oldState.guild.id)) {
                        client.messageQueues.set(oldState.guild.id, []);
                    }
                    
                    // Add leave announcement to message queue with high priority
                    client.messageQueues.get(oldState.guild.id).unshift({
                        text: `${oldState.member.user.username} left the channel`,
                        username: "System",
                        includeUsername: false,
                        timestamp: Date.now()
                    });
                    
                    // Start processing the queue
                    client.processMessageQueue(oldState.guild.id);
                }
                
                // Check if the bot should leave the channel using the dedicated function
                client.checkAndLeaveEmptyChannel(oldState.channel, oldState.guild.id);
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
        const replyContent = { 
            content: 'There was an error executing this command!', 
            ephemeral: true 
        };
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(replyContent).catch(console.error);
        } else {
            await interaction.reply(replyContent).catch(console.error);
        }
    }
});

// Clean up any lingering files on exit
process.on('exit', () => {
    for (const file of activeAudioFiles) {
        safeDeleteFile(file);
    }
});

// Handle errors
client.on('error', console.error);
player.on('error', console.error);

// Login with token from .env file
client.login(process.env.DISCORD_TOKEN);