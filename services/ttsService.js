/**
 * Text-to-Speech service for converting text to audio
 */
const googleTTS = require('google-tts-api');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const { createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { splitTextIntoChunks } = require('../utils/textProcessor');
const { bufferToStream, safeDeleteFile } = require('../utils/fileManager');

/**
 * Process a single TTS chunk and return audio data
 * @param {string} text - Text to convert to speech
 * @param {string} tmpDir - Temporary directory path
 * @param {string} langCode - Language code for TTS
 * @returns {Promise<Object>} - Audio chunk info
 */
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

/**
 * Process text-to-speech conversion for full text
 * @param {string} text - Text to convert
 * @param {string} guildId - Guild ID for the connection
 * @param {Object} client - Discord client
 * @param {boolean} fromQueue - Whether this is from message queue
 * @param {string} langCode - Language code
 * @returns {Promise<void>}
 */
async function processTTS(text, guildId, client, fromQueue = false, langCode = 'en') {
    const player = client.player;
    
    // Create temporary directory if it doesn't exist
    const tmpDir = path.join(__dirname, '..', 'temp');
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
}

module.exports = {
    processTTS,
    processTTSChunk
};