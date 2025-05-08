const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const ServerSettings = require('../models/ServerSettings');
const { getResponseLanguage } = require('../utils/settingsHelper');
const { getText, isLanguageSupported, getAvailableLanguages } = require('../utils/languageManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Configure server-wide TTS settings')
        .addSubcommand(subcommand =>
            subcommand
                .setName('usernames')
                .setDescription('Toggle whether the bot announces usernames'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('joinleave')
                .setDescription('Toggle join/leave announcements'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('language')
                .setDescription('Set the server default TTS language')
                .addStringOption(option => 
                    option.setName('code')
                        .setDescription('2-letter language code (e.g., en, vi)')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    async execute(interaction, client) {
        try {
            // Get the server's response language for messages
            const responseLang = await getResponseLanguage(interaction.guildId);
            
            // Check if user has permission to manage server settings
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ 
                    content: getText('settings.needPermission', responseLang),
                    ephemeral: true 
                });
            }
            
            const subcommand = interaction.options.getSubcommand();
            
            // Find or create server settings
            let settings;
            try {
                settings = await ServerSettings.findOne({ guildId: interaction.guildId });
                if (!settings) {
                    settings = new ServerSettings({ guildId: interaction.guildId });
                }
            } catch (error) {
                console.error('Error fetching server settings:', error);
                return interaction.reply({ 
                    content: getText('error', responseLang),
                    ephemeral: true 
                });
            }
            
            // Handle different subcommands
            switch (subcommand) {
                case 'usernames':
                    settings.disableUsernames = !settings.disableUsernames;
                    await settings.save();
                    
                    if (settings.disableUsernames) {
                        return interaction.reply({ 
                            content: getText('settings.usernames.disabled', responseLang), 
                            ephemeral: true 
                        });
                    } else {
                        return interaction.reply({ 
                            content: getText('settings.usernames.enabled', responseLang), 
                            ephemeral: true 
                        });
                    }
                    
                case 'joinleave':
                    settings.disableJoinLeaveMessages = !settings.disableJoinLeaveMessages;
                    await settings.save();
                    
                    if (settings.disableJoinLeaveMessages) {
                        return interaction.reply({ 
                            content: getText('settings.joinleave.disabled', responseLang), 
                            ephemeral: true 
                        });
                    } else {
                        return interaction.reply({ 
                            content: getText('settings.joinleave.enabled', responseLang), 
                            ephemeral: true 
                        });
                    }
                    
                case 'language':
                    const langCode = interaction.options.getString('code').toLowerCase();
                    
                    // Validate language code
                    if (!isLanguageSupported(langCode)) {
                        return interaction.reply({ 
                            content: getText('settings.language.invalid', responseLang) + 
                                     '\n' + getAvailableLanguages().join(', '), 
                            ephemeral: true 
                        });
                    }
                    
                    // Update the language setting
                    settings.language = langCode;
                    await settings.save();
                    
                    return interaction.reply({ 
                        content: getText('settings.language.updated', responseLang, [langCode]), 
                        ephemeral: true 
                    });
                    
                default:
                    return interaction.reply({ 
                        content: getText('error', responseLang), 
                        ephemeral: true 
                    });
            }
        } catch (error) {
            console.error('Error executing settings command:', error);
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