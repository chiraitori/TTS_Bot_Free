const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const ServerSettings = require('../models/ServerSettings');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Configure TTS bot settings')
        .addSubcommand(subcommand =>
            subcommand
                .setName('usernames')
                .setDescription('Toggle whether usernames are announced before messages')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Whether usernames should be announced')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('joinleave')
                .setDescription('Toggle whether to announce users joining/leaving')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Whether to announce users joining/leaving')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('language')
                .setDescription('Set the TTS language')
                .addStringOption(option =>
                    option.setName('code')
                        .setDescription('The language code (e.g., en, vi, fr, de)')
                        .setRequired(true))),
    
    async execute(interaction, client) {
        // Check if user has permissions to manage server
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({
                content: 'You need the "Manage Server" permission to change these settings.',
                ephemeral: true
            });
        }
        
        const guildId = interaction.guild.id;
        const subcommand = interaction.options.getSubcommand();
        
        try {
            // Find or create settings for this server
            let settings = await ServerSettings.findOne({ guildId });
            if (!settings) {
                settings = new ServerSettings({ guildId });
            }
            
            switch (subcommand) {
                case 'usernames': {
                    const enabled = interaction.options.getBoolean('enabled');
                    settings.disableUsernames = !enabled; // Note: we store "disable" so it's inverted
                    await settings.save();
                    
                    return interaction.reply({
                        content: `Username announcements have been ${enabled ? 'enabled' : 'disabled'}.`,
                        ephemeral: true
                    });
                }
                
                case 'joinleave': {
                    const enabled = interaction.options.getBoolean('enabled');
                    settings.disableJoinLeaveMessages = !enabled; // Note: we store "disable" so it's inverted
                    await settings.save();
                    
                    return interaction.reply({
                        content: `Join/leave announcements have been ${enabled ? 'enabled' : 'disabled'}.`,
                        ephemeral: true
                    });
                }
                
                case 'language': {
                    const langCode = interaction.options.getString('code').toLowerCase();
                    
                    // Validate language code (simple validation)
                    const validLangCodes = ['en', 'vi', 'fr', 'de', 'es', 'it', 'ja', 'ko', 'nl', 'pl', 'pt', 'ru', 'zh'];
                    if (validLangCodes.includes(langCode) || langCode.length === 2) {
                        settings.language = langCode;
                        await settings.save();
                        
                        return interaction.reply({
                            content: `TTS language has been set to "${langCode}".`,
                            ephemeral: true
                        });
                    } else {
                        return interaction.reply({
                            content: `Invalid language code. Please use a valid 2-letter language code (e.g., en, vi, fr, de).`,
                            ephemeral: true
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            return interaction.reply({
                content: 'An error occurred while saving settings. Please try again later.',
                ephemeral: true
            });
        }
    },
};