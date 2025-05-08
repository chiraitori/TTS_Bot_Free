const { SlashCommandBuilder } = require('discord.js');
const { getResponseLanguage } = require('../utils/settingsHelper');
const { getText } = require('../utils/languageManager');
const { enqueueMessage } = require('../services/queueService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Make the bot say something in the voice channel')
        .addStringOption(option => 
            option.setName('message')
                .setDescription('The message to speak')
                .setRequired(true)),
    
    async execute(interaction, client) {
        try {
            await interaction.deferReply({ ephemeral: true });
            
            // Get the server's response language
            const responseLang = await getResponseLanguage(interaction.guildId);
            
            const message = interaction.options.getString('message');
            if (!message) {
                return await interaction.editReply({
                    content: getText('say.emptyMessage', responseLang),
                    ephemeral: true
                });
            }
            
            // Check if the bot is in a voice channel
            const connection = client.connections.get(interaction.guildId);
            if (!connection) {
                // If not in a voice channel, try to join the user's channel
                const voiceChannel = interaction.member.voice.channel;
                if (voiceChannel) {
                    try {
                        client.joinVoiceChannel(voiceChannel, interaction.guildId);
                        // Queue the message - send with no priority since this is a manual command
                        enqueueMessage(
                            interaction.guildId,
                            message,
                            null, // No username for manual say commands
                            null,
                            false,
                            client
                        );
                        
                        return await interaction.editReply({
                            content: getText('say.success', responseLang),
                            ephemeral: true
                        });
                    } catch (error) {
                        console.error('Error joining voice channel:', error);
                        return await interaction.editReply({
                            content: getText('join.failed', responseLang),
                            ephemeral: true
                        });
                    }
                } else {
                    return await interaction.editReply({
                        content: getText('join.notInVoiceChannel', responseLang),
                        ephemeral: true
                    });
                }
            }
            
            // If already in a voice channel, just queue the message
            enqueueMessage(
                interaction.guildId,
                message,
                null, // No username for manual say commands
                null,
                false,
                client
            );
            
            return await interaction.editReply({
                content: getText('say.success', responseLang),
                ephemeral: true
            });
        } catch (error) {
            console.error('Error executing say command:', error);
            try {
                if (interaction.deferred) {
                    await interaction.editReply({
                        content: getText('error', 'en'),
                        ephemeral: true
                    });
                } else if (!interaction.replied) {
                    await interaction.reply({
                        content: getText('error', 'en'),
                        ephemeral: true
                    });
                }
            } catch (replyError) {
                console.error('Failed to send error response:', replyError);
            }
        }
    },
};