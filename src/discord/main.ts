import { Client, IntentsBitField } from "discord.js";
import {
    globalRegistry,
    loadExternalModules,
    pushCommandsToDiscord,
    scanModules,
    setupCommandsAndEvents,
} from "./utility/moduleLoader";
import { cleanMultiline } from "./utility/cleanMultiline";
import { join } from "node:path";
import config from "../utility/config";
import { getProjectRoot } from "../utility/projectRoot";
import chalk from "chalk";

export const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildMembers,
    ],
});


if (config.host.allow_external_modules) {
    await loadExternalModules();
}

await scanModules(join(getProjectRoot(), "src", "modules"));
await setupCommandsAndEvents();
if (process.argv.includes("--register")) {
    await pushCommandsToDiscord(globalRegistry.commands);
}

client.login(process.env.DISCORD_TOKEN);
