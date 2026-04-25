import type { ModuleContext } from "@nuit-bot/api";
import { SlashCommandBuilder } from "discord.js";

export async function setup(ctx: ModuleContext) {
    ctx.api.registerCommand({
        data: new SlashCommandBuilder().setName("ping").setDescription("Pong!"),
        async execute(interaction) {
            await interaction.reply({ content: "Pong!" });
        },
    });
}
