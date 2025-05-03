const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows information about the TTS bot commands'),
    
    async execute(interaction, client) {
        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('Multi-language TTS Bot - Help')
            .setDescription('This bot can read messages in multiple languages using Text-to-Speech technology.')
            .addFields(
                { name: '/join', value: 'Join your voice channel' },
                { name: '/leave', value: 'Leave the voice channel' },
                { name: '/language [option]', value: 'Change the TTS language' },
                { name: '/say [text]', value: 'Convert text to speech' },
                { name: '/help', value: 'Show this help message' }
            )
            .addFields({ 
                name: 'Listening Mode', 
                value: 'Once the bot joins your voice channel, it will automatically read messages sent in text channels.' 
            })
            .addFields({ 
                name: 'Current Language', 
                value: `${process.env.DEFAULT_LANG || 'en'}` 
            })
            .setFooter({ text: 'Powered by Google Text-to-Speech' })
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
    },
};