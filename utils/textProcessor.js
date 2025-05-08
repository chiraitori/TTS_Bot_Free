/**
 * Utility functions for text processing and formatting
 */

/**
 * Process Discord message text - replace links, mentions, and emojis
 * @param {Object} message - Discord message object
 * @returns {Object} - Processed text and expression flag
 */
function processMessageText(message) {
    let text = message.content;
    
    // Handle common chat abbreviations/expressions without saying "said"
    // First check if it's a common expression or standalone emote
    const commonExpressions = ['lmao', 'lol', 'rofl', 'lul', 'kek', 'omg', 'wtf', 'brb', 'afk', 'smh'];
    const isCommonExpression = commonExpressions.includes(text.toLowerCase().trim());
    const isEmote = /^[=:;][\-]?[()DPpOo\[\]\\\/3]+$/.test(text.trim());
    
    // Replace URLs with "a link"
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    text = text.replace(urlRegex, "a link");
    
    // Replace Discord mentions with @displayName (nickname in the server)
    message.mentions.users.forEach(user => {
        const mention = `<@${user.id}>`;
        // Try to get the member object to access their server nickname
        const member = message.guild?.members.cache.get(user.id);
        const displayName = member ? member.displayName : user.username;
        const replacement = `@ ${displayName}`;
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
    
    // Replace emoji codes with emoji names
    // Match custom emoji format <:emojiname:123456789>
    const emojiRegex = /<:(.*?):\d+>/g;
    text = text.replace(emojiRegex, (match, emojiName) => {
        return "emoji " + emojiName;
    });
    
    // Match animated emoji format <a:emojiname:123456789>
    const animatedEmojiRegex = /<a:(.*?):\d+>/g;
    text = text.replace(animatedEmojiRegex, (match, emojiName) => {
        return "emoji " + emojiName;
    });
    
    // Convert different types of emoticons with different brackets
    // Convert :))) style emoticons to =))) style
    const colonEmoticonRegex = /(:)(\)+|\(+)/g;
    text = text.replace(colonEmoticonRegex, (match, colon, brackets) => {
        return "=" + brackets;
    });
    
    // Handle colon-based smileys with nose like :-)
    const noseSmileyRegex = /:-\)/g;
    text = text.replace(noseSmileyRegex, "=-)");
    
    // Handle sad faces like :-(
    const sadFaceRegex = /:-\(/g;
    text = text.replace(sadFaceRegex, "=-(");
    
    // Return the appropriate message format
    return {
        text: text,
        isExpression: isCommonExpression || isEmote
    };
}

/**
 * Split text into chunks of maximum length to fit TTS API constraints
 * @param {string} text - Text to split into chunks
 * @param {number} maxLength - Maximum length of each chunk
 * @returns {Array<string>} - Array of text chunks
 */
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

module.exports = {
    processMessageText,
    splitTextIntoChunks
};