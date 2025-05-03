const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Joins your voice channel to read messages'),
    
    async execute(interaction, client) {
        // Check if the user is in a voice channel
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ 
                content: 'You need to join a voice channel first!', 
                ephemeral: true 
            });
        }

        try {
            // Join the voice channel with explicit connection details
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guildId,
                adapterCreator: interaction.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false,
            });
            
            // Store connection in the client collection
            client.connections.set(interaction.guildId, connection);
            
            // Make sure the player is properly subscribed to this connection
            if (client.player) {
                const subscription = connection.subscribe(client.player);
                if (!subscription) {
                    console.error("Failed to subscribe player to connection");
                    return interaction.reply({ 
                        content: 'Failed to set up audio connection. Please try again.', 
                        ephemeral: true 
                    });
                }
            }
            
            // Just send a reply without announcing in voice
            return interaction.reply(`Joined voice channel: ${voiceChannel.name}`);
        } catch (error) {
            console.error('Error joining voice channel:', error);
            return interaction.reply({ 
                content: 'Failed to join the voice channel. Please try again.', 
                ephemeral: true 
            });
        }
    },
};