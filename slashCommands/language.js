const { SlashCommandBuilder } = require('discord.js');

// Map of supported languages and their codes
const SUPPORTED_LANGUAGES = {
    'english': 'en',
    'vietnamese': 'vi',
    'japanese': 'ja',
    'korean': 'ko',
    'chinese': 'zh-CN',
    'french': 'fr',
    'german': 'de',
    'spanish': 'es',
    'italian': 'it',
    'russian': 'ru',
    'portuguese': 'pt',
    'thai': 'th'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('language')
        .setDescription('Change the TTS language')
        .addStringOption(option =>
            option.setName('language')
                .setDescription('The language to use for TTS')
                .setRequired(true)
                .addChoices(
                    { name: 'English', value: 'en' },
                    { name: 'Vietnamese', value: 'vi' },
                    { name: 'Japanese', value: 'ja' },
                    { name: 'Korean', value: 'ko' },
                    { name: 'Chinese', value: 'zh-CN' },
                    { name: 'French', value: 'fr' },
                    { name: 'German', value: 'de' },
                    { name: 'Spanish', value: 'es' },
                    { name: 'Italian', value: 'it' },
                    { name: 'Russian', value: 'ru' },
                    { name: 'Portuguese', value: 'pt' },
                    { name: 'Thai', value: 'th' }
                )
        ),
    
    async execute(interaction, client) {
        const langCode = interaction.options.getString('language');
        
        // Find the language name from the code
        const langName = Object.keys(SUPPORTED_LANGUAGES).find(
            key => SUPPORTED_LANGUAGES[key] === langCode
        ) || langCode;
        
        // Update the language setting
        process.env.DEFAULT_LANG = langCode;
        
        return interaction.reply(`Language changed to: ${langName} (${langCode})`);
    },
};