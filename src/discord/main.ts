import { Client, IntentsBitField, Collection } from "discord.js";
import loader from "./utility/loader";

export const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
    ]
});

client.commands = new Collection();

await loader.events();
await loader.commands();

await loader.login();