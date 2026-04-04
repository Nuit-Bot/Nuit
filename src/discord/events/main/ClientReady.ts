import chalk from "chalk";
import { Client, Events } from "discord.js";
import { registerCommands } from "../../utility/loader";

export default {
    name: Events.ClientReady,
    once: true,
    async execute(client: Client) {
        console.log(chalk.green(`Ready! Logged in as ${client.user?.tag}`));
        await registerCommands();
    },
};