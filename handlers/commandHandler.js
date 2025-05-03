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
        console.log('Started checking guild-specific application (/) commands...');
        
        // Function to check existing commands and only update if needed
        async function updateCommands(guild) {
            try {
                console.log(`Checking commands for guild: ${guild.name} (${guild.id})...`);
                
                // Fetch existing commands for this guild
                const existingCommands = await rest.get(
                    Routes.applicationGuildCommands(client.user.id, guild.id)
                );
                
                // Check if commands are already registered correctly
                if (existingCommands.length === commands.length) {
                    // Create a map of existing command names for quick lookup
                    const existingCommandMap = new Map();
                    existingCommands.forEach(cmd => {
                        existingCommandMap.set(cmd.name, cmd);
                    });
                    
                    // Check if all commands match existing ones
                    let needsUpdate = false;
                    for (const cmd of commands) {
                        if (!existingCommandMap.has(cmd.name)) {
                            needsUpdate = true;
                            break;
                        }
                        
                        // You could add deeper comparison here if needed
                        // For now we're just checking if the commands exist by name
                    }
                    
                    if (!needsUpdate) {
                        console.log(`Commands already up to date for guild: ${guild.name}`);
                        return;
                    }
                }
                
                // If we got here, we need to update the commands
                console.log(`Updating commands for guild: ${guild.name}...`);
                await rest.put(
                    Routes.applicationGuildCommands(client.user.id, guild.id),
                    { body: commands }
                );
                console.log(`Successfully deployed commands for guild: ${guild.name}`);
                
            } catch (error) {
                console.error(`Error managing commands for guild ${guild.name}:`, error);
            }
        }
        
        // Only register to guilds the bot is in
        if (client.guilds.cache.size > 0) {
            for (const guild of client.guilds.cache.values()) {
                await updateCommands(guild);
            }
            console.log('Guild command registration complete!');
        } else {
            console.log('Bot is not in any guilds yet. Commands will be registered when joining new guilds.');
        }
        
        // Setup event listener for new guilds (only add this listener once)
        // Remove existing listeners first to prevent duplicates
        client.removeAllListeners('guildCreate');
        client.on('guildCreate', async (guild) => {
            try {
                console.log(`Joined new guild: ${guild.name}. Registering commands...`);
                await rest.put(
                    Routes.applicationGuildCommands(client.user.id, guild.id),
                    { body: commands }
                );
                console.log(`Successfully registered commands for new guild: ${guild.name}`);
            } catch (error) {
                console.error(`Failed to register commands for new guild ${guild.name}:`, error);
            }
        });
    } catch (error) {
        console.error('Error during command registration process:', error);
    }
};