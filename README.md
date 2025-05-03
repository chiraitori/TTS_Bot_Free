# TTS Discord Bot

A Discord bot that reads text messages in voice chat channels and converts them to speech using Google's free Text-to-Speech service.

## Features

- Converts text messages to Mutilang speech in real-time
- Automatically joins the same voice channel as the message author
- Completely free - no API key required
- Simple command system

## Prerequisites

- [Node.js](https://nodejs.org/) (v16.9.0 or higher)
- A Discord account and a Discord bot token

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Configure your environment variables:
   - Rename `.env.example` to `.env`
   - Add your Discord bot token

## Getting Your Discord Bot Token

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to the "Bot" tab and click "Add Bot"
4. Click "Reset Token" and copy your token
5. Enable the following Privileged Gateway Intents:
   - MESSAGE CONTENT INTENT
   - GUILD MEMBERS INTENT
   - SERVER MEMBERS INTENT

## Adding the Bot to Your Server

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Go to the "OAuth2" tab
4. In the "OAuth2 URL Generator", select the following scopes:
   - `bot`
   - `applications.commands`
5. Select the following bot permissions:
   - Send Messages
   - Connect
   - Speak
   - Read Message History
6. Copy the generated URL and open it in your browser
7. Select the server where you want to add the bot and authorize

## Usage

1. Start the bot:
   ```
   node index.js
   ```

2. Use the following commands in your Discord server:
   - `!join` - Makes the bot join your voice channel
   - `!leave` - Makes the bot leave the voice channel
   - `!help` - Shows all available commands

3. Just type messages in any text channel while being in a voice channel, and the bot will read them aloud in Vietnamese.

## Limitations

- Google Translate TTS has a limit of 200 characters per request
- Only standard Vietnamese voice is available
- Internet connection is required for the bot to function

## License

This project is licensed under the MIT License - see the LICENSE file for details.