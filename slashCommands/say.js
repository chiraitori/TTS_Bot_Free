const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Converts text to speech and plays it in your voice channel')
        .addStringOption(option =>
            option.setName('text')
                .setDescription('The text you want the bot to say')
                .setRequired(true)
        ),
    
    async execute(interaction, client) {
        // First defer the reply as TTS processing might take some time
        await interaction.deferReply();
        
        // Check if the user is in a voice channel
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.editReply('You need to join a voice channel first!');
        }

        // Get the text to speak
        const textToSpeak = interaction.options.getString('text');
        
        try {
            // Check if we're already in a voice channel in this guild
            let connection = client.connections.get(interaction.guildId);
            if (!connection) {
                // If not, join the user's voice channel with explicit parameters
                connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: interaction.guildId,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                    selfDeaf: false,
                    selfMute: false,
                });
                
                client.connections.set(interaction.guildId, connection);
                
                // Explicitly subscribe the player to this connection
                const subscription = connection.subscribe(client.player);
                if (!subscription) {
                    return interaction.editReply('Failed to set up audio connection. Please try using the /join command first.');
                }
                
                console.log(`Joined voice channel: ${voiceChannel.name} from say command`);
            }
            
            // Double-check the connection is still valid
            if (connection.state.status === 'destroyed' || connection.state.status === 'disconnected') {
                // Reconnect if the connection was destroyed or disconnected
                connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: interaction.guildId,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                    selfDeaf: false,
                    selfMute: false,
                });
                
                client.connections.set(interaction.guildId, connection);
                connection.subscribe(client.player);
                
                console.log(`Reconnected to voice channel: ${voiceChannel.name}`);
            }
            
            // Initialize queue for this guild if it doesn't exist
            if (!client.messageQueues.has(interaction.guildId)) {
                client.messageQueues.set(interaction.guildId, []);
            }
            
            // Add message to queue
            client.messageQueues.get(interaction.guildId).push({
                text: textToSpeak,
                username: interaction.user.username,
                includeUsername: true, // Say username before the message
                timestamp: Date.now()
            });
            
            // Start processing the queue if not already doing so
            client.processMessageQueue(interaction.guildId);
            
            return interaction.editReply(`Queued speech: "${textToSpeak.substring(0, 100)}${textToSpeak.length > 100 ? '...' : ''}"`);
        } catch (error) {
            console.error('Error processing TTS request:', error);
            return interaction.editReply('Failed to process your TTS request. Please try again.');
        }
    },
};