/**
 * Utility functions for text processing and formatting
 */
const { vietnameseEmoticons, englishEmoticons } = require('./emojiMappings');

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
    
    // Expand the emoticon regex pattern to catch more variations
    const isEmote = /^[=:;^T][\-_]?[)(DPpOo\[\]\\\/3<>\.\*xX@\|]+$/i.test(text.trim());
    
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
    });    // Process emoticons - replace them with Vietnamese pronunciation
    // First create a copy of the text to check if it's a standalone emoticon
    const trimmedText = text.trim();
    
    // Check if the entire message is just a single emoticon
    if (vietnameseEmoticons[trimmedText]) {
        // Replace the entire message with the Vietnamese pronunciation
        return {
            text: "mặt " + vietnameseEmoticons[trimmedText],
            isExpression: true
        };
    }
    
    // Process emoticons within text by looking for each one
    // Sort by length (longest first) to avoid partial replacements
    const sortedEmoticons = Object.keys(vietnameseEmoticons)
        .sort((a, b) => b.length - a.length);
        
    sortedEmoticons.forEach(emote => {
        // Use string replacement to avoid regex issues with special characters
        if (text.includes(emote)) {
            // Add word boundaries for more accurate replacements
            text = text.split(emote).join("mặt " + vietnameseEmoticons[emote]);
        }
    });
      // Handle other emoticons that might not be in our mapping
    // Convert both :))) and =))) style emoticons if they're not already handled
    const faceEmoticonRegex = /([:=])(\)+|\(+)/g;
    text = text.replace(faceEmoticonRegex, (match, prefix, brackets) => {
        const fullMatch = prefix + brackets;
        return vietnameseEmoticons[fullMatch] ? 
              ("mặt " + vietnameseEmoticons[fullMatch]) : 
              (brackets.startsWith(')') ? "mặt cười" + (brackets.length > 1 ? " to" : "") : 
               brackets.startsWith('(') ? "mặt buồn" + (brackets.length > 1 ? " dài" : "") : match);
    });
    
    // Handle colon-based smileys with nose like :-) or =-)
    const noseSmileyRegex = /[=:][-]?\)/g;
    text = text.replace(noseSmileyRegex, (match) => {
        return vietnameseEmoticons[match] ? 
               ("mặt " + vietnameseEmoticons[match]) : "mặt cười";
    });
    
    // Handle sad faces like :-( or =-(
    const sadFaceRegex = /[=:][-]?\(/g;
    text = text.replace(sadFaceRegex, (match) => {
        return vietnameseEmoticons[match] ? 
               ("mặt " + vietnameseEmoticons[match]) : "mặt buồn";
    });
    
    // Improve question mark reading by adding a space after it if followed by text
    text = text.replace(/\?(\w)/g, '? $1');
    
    // Make sure multiple question marks are properly spaced
    text = text.replace(/\?\?+/g, '? ?');
      
    // Improve pronounciation of special characters and punctuation
    text = improveTextForTTS(text);
    
    // Return the appropriate message format
    return {
        text: text,
        isExpression: isCommonExpression || isEmote
    };
}

/**
 * Improves text for TTS reading by handling special characters and punctuation
 * @param {string} text - The text to improve
 * @returns {string} - The improved text
 */
function improveTextForTTS(text) {
    // Add spacing around question marks for better pronunciation
    text = text.replace(/(\w)\?/g, '$1 ?');
    text = text.replace(/\?(\w)/g, '? $1');
    
    // Fix multiple question marks
    text = text.replace(/\?{2,}/g, '? ?');
    
    // Fix emoticons starting with = (ensure they're properly separated from text)
    text = text.replace(/(\w)([=:][\-]?[\(\)DPp])/g, '$1 $2');
    text = text.replace(/([=:][\-]?[\(\)DPp])(\w)/g, '$1 $2');
    
    // Fix emoticons with repeated characters (like ===))))) or ::::))))
    const repeatedEmoticonRegex = /([=:])(\1+)([()]+)/g;
    text = text.replace(repeatedEmoticonRegex, (match, prefix, repeats, brackets) => {
        return brackets.startsWith(')') ? 
               "mặt cười " + (brackets.length > 2 ? "rất to" : "to") : 
               "mặt buồn " + (brackets.length > 2 ? "rất dài" : "dài");
    });
    
    // Make sure numbers are read correctly
    text = text.replace(/(\d)\.(\d)/g, '$1 chấm $2');
    
    // Make sure ellipsis are read correctly
    text = text.replace(/\.{3,}/g, ' chấm chấm chấm ');
    
    // Add spaces around special characters for better pronunciation
    text = text.replace(/(\w)([!@#$%^&*()_+={}[\]:;<>,./\\])/g, '$1 $2');
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