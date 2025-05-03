const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = async (client) => {
    // Command collection setup
    client.commands = new Map();
    const commands = [];

    // Path to the slash commands directory
    const commandsPath = path.join(__dirname, '../slashCommands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    // Register each command in the directory
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        // Add command to collection if it has data and execute properties
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
            console.log(`Loaded command: ${command.data.name}`);
        } else {
            console.log(`Warning: Command at ${filePath} is missing required data or execute property!`);
        }
    }

    // Register commands with Discord
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('Started refreshing application (/) commands...');
        
        // If CLIENT_ID is provided in .env, register commands globally
        if (process.env.CLIENT_ID) {
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );
            console.log('Successfully registered commands globally.');
        } 
        // Otherwise register to all guilds the bot is in
        else {
            // Get all guilds the bot is in
            if (client.guilds.cache.size > 0) {
                for (const guild of client.guilds.cache.values()) {
                    await rest.put(
                        Routes.applicationGuildCommands(client.user.id, guild.id),
                        { body: commands }
                    );
                    console.log(`Registered commands for guild: ${guild.name}`);
                }
            } else {
                console.warn('Bot is not in any guilds yet. Commands will be registered when the bot joins a guild.');
            }
        }
        
        console.log('Command registration complete!');
    } catch (error) {
        console.error('Error while registering commands:', error);
    }
};