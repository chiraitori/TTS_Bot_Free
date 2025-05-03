const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Leaves the voice channel'),
    
    async execute(interaction, client) {
        // Check if the bot is in a voice channel in this guild
        const connection = client.connections.get(interaction.guildId);
        if (!connection) {
            return interaction.reply({ 
                content: 'I\'m not in any voice channel!', 
                ephemeral: true 
            });
        }

        try {
            // Destroy the connection
            connection.destroy();
            client.connections.delete(interaction.guildId);
            
            
            return interaction.reply('Left the voice channel.');
        } catch (error) {
            console.error('Error leaving voice channel:', error);
            return interaction.reply({ 
                content: 'Failed to leave the voice channel. Please try again.', 
                ephemeral: true 
            });
        }
    },
};