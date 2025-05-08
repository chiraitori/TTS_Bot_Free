const { SlashCommandBuilder } = require('discord.js');
const { getResponseLanguage } = require('../utils/settingsHelper');
const { getText } = require('../utils/languageManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Joins your voice channel to read messages'),
    
    async execute(interaction, client) {
        try {
            // IMMEDIATELY defer the reply to extend the 3-second timeout window
            await interaction.deferReply();
            
            // Get the server's response language
            const responseLang = await getResponseLanguage(interaction.guildId);
            
            // First check if user is in a voice channel
            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
                return interaction.editReply(getText('join.userNotInVoiceChannel', responseLang));
            }

            // Check if the bot is already in a voice channel in this guild
            const existingConnection = client.connections.get(interaction.guildId);
            if (existingConnection) {
                // If the bot is already in the same voice channel, just acknowledge it
                if (existingConnection.joinConfig.channelId === voiceChannel.id) {
                    return interaction.editReply(getText('join.alreadyConnected', responseLang, [voiceChannel.name]));
                } else {
                    // Check if anyone is using the bot in the current channel
                    const currentChannel = interaction.guild.channels.cache.get(existingConnection.joinConfig.channelId);
                    if (currentChannel) {
                        const currentMembers = currentChannel.members.filter(member => !member.user.bot);
                        
                        // If there are users in the current channel, don't allow stealing the bot
                        if (currentMembers.size > 0) {
                            return interaction.editReply(getText('join.inUseElsewhere', responseLang, [currentChannel.id]));
                        }
                        // If no users in the current channel, we can move to the new channel
                    }
                }
            }

            // Now handle the voice connection
            try {
                // Update reply to show we're connecting
                await interaction.editReply(getText('join.connecting', responseLang, [voiceChannel.name]));
                
                const connection = client.joinVoiceChannel(voiceChannel, interaction.guildId);
                
                // Make sure the player is properly subscribed to this connection
                if (client.player) {
                    const subscription = connection.subscribe(client.player);
                    if (!subscription) {
                        console.error("Failed to subscribe player to connection");
                        return interaction.editReply(getText('join.failed', responseLang));
                    }
                }
                
                // Update the reply since we've now connected successfully
                return interaction.editReply(getText('join.success', responseLang, [voiceChannel.name]));
            } catch (error) {
                console.error('Error joining voice channel:', error);
                // Try to update the reply to show the error
                return interaction.editReply(getText('join.failed', responseLang));
            }
        } catch (error) {
            console.error('Error in join command:', error);
            // Try to respond if we can
            try {
                if (interaction.deferred) {
                    await interaction.editReply(getText('error', 'en'));
                } else if (!interaction.replied) {
                    await interaction.reply({ 
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