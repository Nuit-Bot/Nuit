import type { Interaction } from "discord.js";
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    GuildMember,
    MessageFlags,
    PermissionsBitField,
    SlashCommandBuilder,
} from "discord.js";
import { cleanMultiline } from "../../discord/utility/cleanMultiline";
import type { ModuleContext } from "@nuit-bot/api";

export async function setup(ctx: ModuleContext) {
    await ctx.api.registerCommand({
        data: new SlashCommandBuilder()
            .setName("ban")
            .setDescription("Bans a selected user")
            .setDescriptionLocalization(
                "fr",
                "Bannis un utilisateur sélectionné",
            )
            .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers)
            .addUserOption((option) =>
                option
                    .setName("target")
                    .setDescription("The user to ban")
                    .setNameLocalization("fr", "cible")
                    .setDescriptionLocalization("fr", "L'utilisateur à bannir ")
                    .setRequired(true),
            )
            .addStringOption((option) =>
                option
                    .setName("reason")
                    .setDescription("The reason to ban the user")
                    .setNameLocalization("fr", "raison")
                    .setDescriptionLocalization(
                        "fr",
                        "La raison de bannir l'utilisateur",
                    ),
            ),
        async execute(interaction: Interaction) {
            if (!interaction.isChatInputCommand()) return;

            await interaction.deferReply({
                flags: MessageFlags.Ephemeral,
            });

            // We check permissions incase `.setDefaultMemberPermissions` has a weird use case or the command is ran unconventionnally
            const permissions = interaction.member!
                .permissions as PermissionsBitField;
            if (!permissions.has(PermissionsBitField.Flags.BanMembers)) {
                return await interaction.editReply({
                    content: cleanMultiline(`# Well that's weird!
                You shouldn't be able to run that command unless you have some sort of trick up your sleeve.
                -# But I guess it's okay, since you can't ban anyone anyway.`),
                });
            }

            const botMember = await interaction.guild!.members!.fetch(
                interaction.client.user.id,
            );
            if (
                !botMember.permissions.has(PermissionsBitField.Flags.BanMembers)
            ) {
                return await interaction.editReply({
                    content: cleanMultiline(`# Well that's awkward!
                I'm lacking the permission to ban users from this server.
                -# Maybe an admin could grant it to me? I promise I won't nuke anything!`),
                });
            }

            let targetMember: GuildMember;
            try {
                targetMember = await interaction.guild!.members.fetch(
                    interaction.options.getUser("target")!.id,
                );
            } catch (error) {
                return await interaction.editReply({
                    content: cleanMultiline(`# User not found!
                The user you're trying to ban doesn't seem to exist or isn't in this server.
                -# Make sure the user is still in the server and try again.`),
                });
            }

            const botHighest = botMember.roles.highest;
            const targetHighest = targetMember.roles.highest;
            if (botHighest.position <= targetHighest.position) {
                return await interaction.editReply({
                    content: cleanMultiline(`# Well that's unfortunate!
                I can't ban that user since my role is lower or equal to theirs.
                -# Maybe an admin with higher permissions could give me that access?`),
                });
            }

            const admin = interaction.member as GuildMember;
            const adminHighest = admin?.roles.highest;
            if (adminHighest.position <= targetHighest.position) {
                return await interaction.editReply({
                    content: cleanMultiline(`# Well that's not gonna work!
                You can't ban someone with a role higher than or equal to yours.
                -# Role hierarchy matters, even for admins! Maybe ask someone with higher permissions?`),
                });
            }

            const confirmEmbed = new EmbedBuilder()
                .setColor("Blurple")
                .setDescription(
                    `Are you sure you want to ban \`${targetMember.displayName}\` from this server?`,
                )
                .addFields(
                    {
                        name: `\`${targetMember.displayName}\``,
                        value: `**Time on the server**: <t:${Math.floor(targetMember.joinedTimestamp! / 1000)}:R>`,
                    },
                    {
                        name: "Reason",
                        value: `${interaction.options.getString("reason") || "No reason specified"}`,
                    },
                )
                .setFooter({ text: "You have 2 minutes to answer" })
                .setTimestamp();

            const confirmButton = new ButtonBuilder()
                .setCustomId(
                    `ban/confirm/${targetMember.id}/${Date.now().toString()}`,
                )
                .setLabel("Confirm")
                .setEmoji("✅")
                .setStyle(ButtonStyle.Primary);

            const cancelButton = new ButtonBuilder()
                .setCustomId(
                    `ban/cancel/${targetMember.id}/${Date.now().toString()}`,
                )
                .setLabel("Cancel")
                .setEmoji("❌")
                .setStyle(ButtonStyle.Primary);

            const actionRow =
                new ActionRowBuilder<ButtonBuilder>().setComponents(
                    confirmButton,
                    cancelButton,
                );

            await interaction.editReply({
                embeds: [confirmEmbed],
                components: [actionRow],
            });

            const response = await interaction.fetchReply();

            const collectorFilter = (i: ButtonInteraction) =>
                i.customId.startsWith("ban/") &&
                i.user.id === interaction.user.id;

            try {
                const confirmation = await response.awaitMessageComponent({
                    filter: collectorFilter,
                    time: 120_000,
                    componentType: ComponentType.Button,
                });

                if (confirmation.customId.startsWith("ban/confirm")) {
                    await confirmation.update({
                        content: `# Processing ban...\nMaking sure ${targetMember.displayName} can't come back to cause chaos.\n-# This might take a moment while I work my magic.`,
                        components: [],
                        embeds: [],
                    });

                    try {
                        await targetMember.ban({
                            reason:
                                interaction.options.getString("reason") ||
                                undefined,
                        });
                        await interaction.editReply({
                            content: `# Got 'em!\n${targetMember.displayName} has been successfully banned from the server.\n-# They won't be causing trouble anymore!`,
                        });
                    } catch (error) {
                        await interaction.editReply({
                            content: `# Oops!\nSomething went wrong while trying to ban this user.\n-# Maybe they left already? Or I don't have enough permissions?`,
                        });
                    }
                } else if (confirmation.customId.startsWith("ban/cancel")) {
                    await confirmation.update({
                        content: "Ban operation cancelled.",
                        components: [],
                        embeds: [],
                    });
                }
            } catch (error) {
                await interaction.editReply({
                    content: `# Time's up!\nNo response received, so I'm not banning anyone.\n-# Maybe you changed your mind? That's cool too!`,
                    components: [],
                    embeds: [],
                });
            }
        },
    });
}
