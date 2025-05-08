const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getResponseLanguage } = require('../utils/settingsHelper');
const { getText } = require('../utils/languageManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows information about the bot and available commands'),
    
    async execute(interaction, client) {
        try {
            // Get the server's response language
            const responseLang = await getResponseLanguage(interaction.guildId);
            
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(getText('help.title', responseLang))
                .setDescription(getText('help.description', responseLang))
                .addFields(
                    { name: '/join', value: getText('help.commands.join', responseLang), inline: false },
                    { name: '/leave', value: getText('help.commands.leave', responseLang), inline: false },
                    { name: '/say', value: getText('help.commands.say', responseLang), inline: false },
                    { name: '/mylanguage', value: getText('help.commands.language', responseLang), inline: false },
                    { name: '/settings', value: getText('help.commands.settings', responseLang), inline: false },
                    { name: '/help', value: getText('help.commands.help', responseLang), inline: false }
                )
                .setFooter({ text: getText('help.footer', responseLang) });
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error executing help command:', error);
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