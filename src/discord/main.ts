import { Client, IntentsBitField } from "discord.js";
import { scanModules, setupCommandsAndEvents } from "./utility/moduleLoader";
import { join } from "path";
import { existsSync } from "fs";

export const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
    ],
});

scanModules(join(import.meta.dirname, "..", "modules"));

// TODO: Add registry fetching and cloning

if (existsSync(join(import.meta.dirname, "..", "registry-modules"))) {
    scanModules(join(import.meta.dirname, "..", "registry-modules"));
}

setupCommandsAndEvents();

client.login(process.env.DISCORD_TOKEN);
