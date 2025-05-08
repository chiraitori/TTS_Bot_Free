/**
 * Language manager utility
 * Provides functions for retrieving localized text
 */

// Import language files
const languages = {
    'en': require('../lang/en'),
    'vi': require('../lang/vi')
};

// List of supported languages
const supportedLanguages = Object.keys(languages);

/**
 * Get a text string from the language files
 * @param {string} key - Dot notation path to the text (e.g. 'join.success')
 * @param {string} lang - Language code (e.g. 'en', 'vi')
 * @param {Array} params - Parameters to replace placeholders in the text
 * @returns {string} - Localized text
 */
function getText(key, lang = 'en', params = []) {
    // Default to English if the requested language doesn't exist
    if (!languages[lang]) {
        lang = 'en';
    }
    
    // Split the key path and navigate the language object
    const keyPath = key.split('.');
    let text = languages[lang];
    
    for (const part of keyPath) {
        if (text && text[part] !== undefined) {
            text = text[part];
        } else {
            // If key not found in requested language, fall back to English
            text = getTextFromLanguage('en', keyPath);
            break;
        }
    }
    
    // If text is not a string (e.g., it's an object), or if it's undefined
    if (typeof text !== 'string') {
        // Use the most specific key as the default text
        return `[Missing text: ${key}]`;
    }
    
    // Replace placeholders with parameters
    return replacePlaceholders(text, params);
}

/**
 * Get text from a specific language using key path array
 * @param {string} lang - Language code
 * @param {Array<string>} keyPath - Array of key parts
 * @returns {string|undefined} - The text or undefined if not found
 */
function getTextFromLanguage(lang, keyPath) {
    let text = languages[lang];
    
    for (const part of keyPath) {
        if (text && text[part] !== undefined) {
            text = text[part];
        } else {
            return undefined;
        }
    }
    
    return text;
}

/**
 * Replace placeholders like {0}, {1} with provided parameters
 * @param {string} text - Text with placeholders
 * @param {Array} params - Parameters to replace placeholders
 * @returns {string} - Text with replaced placeholders
 */
function replacePlaceholders(text, params = []) {
    if (!params || params.length === 0) {
        return text;
    }
    
    let result = text;
    for (let i = 0; i < params.length; i++) {
        // Use string replace instead of RegExp to avoid escape issues
        // or properly escape the curly braces in the RegExp pattern
        const placeholder = `{${i}}`;
        // Use a safe replacement approach that doesn't rely on RegExp constructor
        result = result.split(placeholder).join(params[i]);
    }
    
    return result;
}

/**
 * Check if a language code is supported
 * @param {string} langCode - Language code to check
 * @returns {boolean} - True if language is supported
 */
function isLanguageSupported(langCode) {
    return supportedLanguages.includes(langCode);
}

/**
 * Get a list of all available language codes
 * @returns {Array<string>} - Array of supported language codes
 */
function getAvailableLanguages() {
    return [...supportedLanguages];
}

module.exports = {
    getText,
    supportedLanguages,
    isLanguageSupported,
    getAvailableLanguages
};