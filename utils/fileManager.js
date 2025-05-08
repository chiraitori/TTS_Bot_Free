/**
 * Utility functions for file management and disk operations
 */
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

// Set to track active audio files
const activeAudioFiles = new Set();

/**
 * Create a readable stream from a buffer
 * @param {Buffer} buffer - Buffer to convert to stream
 * @returns {Readable} - Readable stream
 */
function bufferToStream(buffer) {
    const readable = new Readable();
    readable._read = () => {}; // _read is required but we'll push manually
    readable.push(buffer);
    readable.push(null);
    return readable;
}

/**
 * Safely remove a file with error handling and retry logic
 * @param {string} filePath - Path to file to delete
 */
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

/**
 * Check disk space and clean up temporary files if needed
 */
async function checkAndCleanupDiskSpace() {
    const tmpDir = path.join(__dirname, '..', 'temp');
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

/**
 * Clean up all active audio files on exit
 */
function cleanupOnExit() {
    for (const file of activeAudioFiles) {
        safeDeleteFile(file);
    }
}

// Track active audio files
function addActiveAudioFile(filePath) {
    activeAudioFiles.add(filePath);
}

// Remove from tracking
function removeActiveAudioFile(filePath) {
    activeAudioFiles.delete(filePath);
}

module.exports = {
    bufferToStream,
    safeDeleteFile,
    checkAndCleanupDiskSpace,
    cleanupOnExit,
    addActiveAudioFile,
    removeActiveAudioFile,
    activeAudioFiles
};