const { SlashCommandBuilder } = require('discord.js');
const { getResponseLanguage } = require('../utils/settingsHelper');
const { getText } = require('../utils/languageManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Leave the current voice channel'),
    
    async execute(interaction, client) {
        try {
            // Get the server's response language
            const responseLang = await getResponseLanguage(interaction.guildId);
            
            // Check if the bot is in a voice channel in this guild
            const connection = client.connections.get(interaction.guildId);
            if (!connection) {
                return interaction.reply({
                    content: getText('leave.notInVoiceChannel', responseLang),
                    ephemeral: true
                });
            }
            
            // Let the user know we're leaving
            await interaction.reply({
                content: getText('leave.leaving', responseLang),
                ephemeral: true
            });
            
            try {
                // Attempt to destroy the connection
                connection.destroy();
                
                // Clean up resources
                client.connections.delete(interaction.guildId);
                client.voiceUsers.delete(interaction.guildId);
                client.messageQueues.delete(interaction.guildId);
                client.isProcessingQueue.delete(interaction.guildId);
                
                // Let the user know we've left
                await interaction.editReply({
                    content: getText('leave.success', responseLang),
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error leaving voice channel:', error);
                await interaction.editReply({
                    content: getText('leave.failed', responseLang),
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Error executing leave command:', error);
            try {
                // Try to reply if we haven't already
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: getText('error', 'en'),
                        ephemeral: true
                    });
                } else {
                    await interaction.editReply({
                        content: getText('error', 'en'),
                        ephemeral: true
                    });
                }
            } catch (replyError) {
                console.error('Failed to reply to interaction:', replyError);
            }
        }
    },
};