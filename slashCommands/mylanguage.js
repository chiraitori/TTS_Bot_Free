const { SlashCommandBuilder } = require('discord.js');
const { setUserLanguage, getUserSettings, getResponseLanguage } = require('../utils/settingsHelper');
const { getText, isLanguageSupported, getAvailableLanguages } = require('../utils/languageManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mylanguage')
        .setDescription('Set your personal TTS language preference')
        .addStringOption(option => 
            option.setName('code')
                .setDescription('The 2-letter language code (e.g., en, fr, de, vi)')
                .setRequired(false)),
    
    async execute(interaction, client) {
        try {
            // Get the server's response language
            const responseLang = await getResponseLanguage(interaction.guildId);
            
            // If no language code provided, show current setting
            const langCode = interaction.options.getString('code');
            if (!langCode) {
                const userSettings = await getUserSettings(interaction.user.id);
                const currentLang = userSettings.language || await getResponseLanguage(interaction.guildId);
                
                return interaction.reply({
                    content: getText('language.currentLanguage', responseLang, [currentLang]),
                    ephemeral: true
                });
            }
            
            // Validate the language code
            if (!isLanguageSupported(langCode) && langCode !== 'default') {
                return interaction.reply({
                    content: getText('language.invalidLanguage', responseLang) + 
                    '\n' + getAvailableLanguages().join(', '),
                    ephemeral: true
                });
            }
            
            // Handle request to reset to server default
            const newLang = langCode.toLowerCase() === 'default' ? null : langCode.toLowerCase();
            
            // Update the user's language preference
            await setUserLanguage(interaction.user.id, newLang);
            
            // Confirm the change
            const displayLang = newLang || await getResponseLanguage(interaction.guildId) + ' (server default)';
            return interaction.reply({
                content: getText('language.updated', responseLang, [displayLang]),
                ephemeral: true
            });
        } catch (error) {
            console.error('Error executing mylanguage command:', error);
            
            try {
                await interaction.reply({
                    content: getText('error', 'en'),
                    ephemeral: true
                });
            } catch (replyError) {
                console.error('Failed to send error response:', replyError);
            }
        }
    },
};