import { REST, type GatewayIntentBits, type IntentsBitField, Routes } from "discord.js";
import { client } from "../main";
import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';

const eventsPath = path.join(import.meta.dirname, '..', 'events');
const eventFolders = await fs.readdir(eventsPath);
const commandsPath = path.join(import.meta.dirname, '..', 'commands');
const commandsFolders = await fs.readdir(commandsPath);
const commandsList: { filePath: string, command: any }[] = []

for (const folder of commandsFolders) {
    const commandFiles = (await fs.readdir(path.join(commandsPath, folder))).filter(file => file.endsWith('.ts'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, folder, file);
        const command = (await import(filePath)).default;
        commandsList.push({ filePath, command })
    }
}

export type Intents = Array<GatewayIntentBits | IntentsBitField>;

async function events() {
    for (const folder of eventFolders) {
        const eventFiles = (await fs.readdir(path.join(eventsPath, folder))).filter(file => file.endsWith('.ts'));
        for (const file of eventFiles) {
            const filePath = path.join(eventsPath, folder, file);
            const event = (await import(filePath)).default;
            if (!event) {
                console.warn(`File ${file} has no event data, skipping.`);
                continue;
            }
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args));
            } else {
                client.on(event.name, (...args) => event.execute(...args));
            }
        }
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN as string);

async function commands() {
    for (const file of commandsList) {
        const command = file.command;
        if (!command) {
            console.warn(`File ${file.filePath} has no command data, skipping.`);
            continue;
        }
        // Set command to client for execution
        client.commands.set(command.data.name, command);
    }
}

export async function registerCommands() {
    const commandsData = [];

    for (const file of commandsList) {
        if (!file.command || !file.command.data.toJSON()) {
            console.warn(`File ${file} has no command data, skipping.`);
            continue;
        }
        // Add command data for registration
        commandsData.push(file.command.data.toJSON());
    }

    // Register commands with Discord
    try {
        console.log(chalk.blue(`Started refreshing ${commandsData.length} application (/) commands.`));

        const data: any = await rest.put(
            Routes.applicationCommands(client.user?.id as string),
            { body: commandsData }
        );

        console.log(chalk.green(`Successfully reloaded ${data.length} application (/) commands.`));
    } catch (error) {
        console.error(chalk.red('Error registering commands:'), error);
    }
}

async function login() {
    client.login(process.env.DISCORD_TOKEN);
}

export default { events, commands, login };