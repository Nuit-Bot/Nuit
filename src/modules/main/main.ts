import type { ModuleContext } from "@nuit-bot/api";
import {
    MessageFlags,
    SlashCommandBuilder,
    ChatInputCommandInteraction,
} from "discord.js";
import { cleanMultiline } from "../../discord/utility/cleanMultiline";

export async function setup(ctx: ModuleContext) {
    ctx.api.registerCommand({
        data: new SlashCommandBuilder().setName("ping").setDescription("Pong!"),
        async execute(interaction: ChatInputCommandInteraction) {
            await interaction.reply({
                content: cleanMultiline(`Pong 🏓!
                Bot's API latency: \`${interaction.client.ws.ping}\`ms
                General bot latency: \`${Date.now() - interaction.createdTimestamp}\`ms`),
                flags: MessageFlags.Ephemeral,
            });
        },
    });
}
