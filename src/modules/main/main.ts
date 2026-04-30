import type { ModuleContext } from "@nuit-bot/api";
import {
    MessageFlags,
    SlashCommandBuilder,
    Events,
    type Interaction,
} from "discord.js";
import { cleanMultiline } from "../../discord/utility/cleanMultiline";
import { randomInt } from "node:crypto";
import chalk from "chalk";

const loadingPhrases = [
    "Bip boop, Nuit is here!",
    "Hello, world!",
    "Nuit has entered the chat.",
    "Booting up the night shift...",
    "Ready to cause some chaos.",
    "Online and unhinged.",
    "The bot has awakened.",
    "Nuit reporting for duty!",
    "Successfully pretending to work.",
    "All systems go. Probably.",
    "I'm awake, I'm awake...",
    "Loaded! Don't ask how long it took.",
];

export async function setup(ctx: ModuleContext) {
    ctx.api.registerCommand({
        data: new SlashCommandBuilder().setName("ping").setDescription("Pong!"),
        async execute(interaction: Interaction) {
            if (!interaction.isChatInputCommand()) return;
            await interaction.reply({
                content: cleanMultiline(`Pong 🏓!
                Bot's API latency: \`${interaction.client.ws.ping}\`ms
                General bot latency: \`${Date.now() - interaction.createdTimestamp}\`ms`),
                flags: MessageFlags.Ephemeral,
            });
        },
    });

    ctx.api.onceEvent(
        Events.ClientReady,
        (client) => {
            if (process.env.NODE_ENV === "development") {
                client.user.setPresence({ status: "idle" });
            } else {
                client.user.setPresence({ status: "online" });
            }
            console.log(
                chalk.blueBright(
                    loadingPhrases[randomInt(loadingPhrases.length)],
                ),
            );
        },
        { guildScoped: false },
    );
}
