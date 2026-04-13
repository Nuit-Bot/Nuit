import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { registerCommands } from "../../utility/loader";
import config from "../../../utility/config";
import { cleanMultiline } from "../../utility/cleanMultiline";

export default {
    data: new SlashCommandBuilder()
        .setName("reload-commands")
        .setDescription("Reloads bot commands. Bot hosters only."),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        })

        // Check if user is a part of config.host.hosters
        if (!config.host.hosters.includes(interaction.user.id)) {
            return await interaction.editReply({
                content: cleanMultiline(`# What'cha tryna do?
                                        You're not a hoster, so you can't reload commands.
                                        -# You need to be apart of the bot hosters to do this.`)
            })
        }

        // Check if allow_command_reloading is enabled
        if (!config.host.allow_command_reloading) {
            return await interaction.editReply({
                content: cleanMultiline(`# Well, that's awkward
                                        Reloading commands is disabled by the bot hosters.
                                        -# Enable \`host.allow_command_reloading\` in \`config.toml\` to enable this.`)
            })
        }

        const confirmEmbed = new EmbedBuilder()
            .setTitle("Reload Commands")
            .setDescription(cleanMultiline(`Are you sure you want to reload all the commands from the bot?
                                            This will cause some bot unstability for a bit.`));

        // Create confirmation components
        const confirmButton = new ButtonBuilder()
            .setCustomId(`reload/confirm/${Date.now()}`)
            .setLabel("Confirm")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Primary);

        const cancelButton = new ButtonBuilder()
            .setCustomId(`reload/cancel/${Date.now()}`)
            .setLabel("Cancel")
            .setEmoji("❌")
            .setStyle(ButtonStyle.Secondary);

        const actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(confirmButton, cancelButton);

        await interaction.editReply({
            embeds: [confirmEmbed],
            components: [actionRow]
        });

        const response = await interaction.fetchReply();

        // Wait for user response
        const filter = (i: any) => i.customId.startsWith('reload/') && i.user.id === interaction.user.id;
        try {
            const confirmation = await response.awaitMessageComponent({
                filter,
                time: 30_000 // 30 seconds to respond
            });

            if (confirmation.customId.includes('reload/confirm')) {
                await confirmation.update({
                    content: "Reloading commands...",
                    embeds: [],
                    components: []
                });

                await registerCommands();

                await interaction.followUp({
                    content: cleanMultiline(`# Success!
                                            Commands have been reloaded successfully!
                                            -# The bot might take a moment to reflect the changes.`),
                    flags: MessageFlags.Ephemeral
                });
            } else if (confirmation.customId.includes('reload/cancel')) {
                await confirmation.update({
                    content: "Command reload cancelled.",
                    embeds: [],
                    components: []
                });
            }
        } catch (error) {
            // User didn't respond in time
            await interaction.editReply({
                content: "Confirmation not received in time. Command reload cancelled.",
                embeds: [],
                components: []
            });
        }
    }
}