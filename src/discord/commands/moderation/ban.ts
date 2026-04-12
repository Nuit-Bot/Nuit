import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, GuildMember, GuildMemberRoleManager, MessageFlags, PermissionsBitField, SlashCommandBuilder } from "discord.js";

export default {
    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Bans a selected user")
        .setDescriptionLocalization("fr", "Bannis un utilisateur sélectionné")
        .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers)
        .addUserOption(option => option.setName("target")
            .setDescription("The user to ban")

            // Localization
            .setNameLocalization("fr", "cible")
            .setDescriptionLocalization("fr", "L'utilisateur à bannir ")

            // Always required
            .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        // Defer the reply / show a loading message to the user
        // It's also ephemeral, so it only shows to the user who ran the command
        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        // We check permissions incase `.setDefaultMemberPermissions` has a weird use case or the command is ran unconventionnally
        const permissions = interaction.member!.permissions as PermissionsBitField;
        if (!permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return await interaction.editReply({
                content: `# Well that's weird!
                You shouldn't be able to run that command unless you have some sort of trick up your sleeve.
                -# But I guess it's okay, since you can't ban anyone anyway.` });
        }

        // Check if the bot has ban members permission
        const botMember = await interaction.guild!.members!.fetch(interaction.client.user.id);
        if (!botMember.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return await interaction.editReply({
                content: `# Well that's awkward!
                I'm lacking the permission to ban users from this server.
                -# Maybe an admin could grant it to me? I promise I won't nuke anything!`
            });
        }

        // Check if the bot can ban the target
        const target = interaction.guild?.members.fetch(interaction.options.getUser("target")!.id)!;
        const botHighest = botMember.roles.highest;
        const targetHighest = (await target).roles.highest;
        if (botHighest.position <= targetHighest.position) {
            return await interaction.editReply({
                content: `# Well that's unfortunate!
                I can't ban that user since my role is lower or equal to theirs.
                -# Maybe an admin with higher permissions could give me that access?`
            });
        }

        // Check if the admin can ban the target
        const admin = interaction.member as GuildMember;
        const adminHighest = admin?.roles.highest;
        if (adminHighest.position <= targetHighest.position) {
            return await interaction.editReply({
                content: `# Well that's not gonna work!
                You can't ban someone with a role higher than or equal to yours.
                -# Role hierarchy matters, even for admins! Maybe ask someone with higher permissions?`
            });
        }

        // Now, the ban mechanism (after 1 hour of making checks)
        const confirmEmbed = new EmbedBuilder()
            .setColor("Blurple")
            .setDescription(`Are you sure you want to ban \`${(await target).displayName}\` from this server?`)
            .setFields({
                name: `\`${(await target).displayName}\``,
                value: `**Time on the server**: <t:${Math.floor((await target).joinedTimestamp! / 1000)}:R>}`,
            })
            .setFooter({ text: "You have 2 minutes to answer" })
            .setTimestamp();

        const confirmButton = new ButtonBuilder()
            .setCustomId(`ban/confirm/${(await target).id}/${Date.now().toString()}`)
            .setLabel("Confirm")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Primary);

        const cancelButton = new ButtonBuilder()
            .setCustomId(`ban/cancel/${(await target).id}/${Date.now().toString()}`)
            .setLabel("Cancel")
            .setEmoji("❌")
            .setStyle(ButtonStyle.Primary);

        const actionRow = new ActionRowBuilder<ButtonBuilder>()
            .setComponents(confirmButton, cancelButton);

        await interaction.editReply({
            embeds: [confirmEmbed],
            components: [actionRow]
        });

        const response = await interaction.fetchReply();

        const collectorFilter = (i: ButtonInteraction) =>
            i.customId.startsWith('ban/') &&
            i.user.id === interaction.user.id;

        try {
            const confirmation = await response.awaitMessageComponent({
                filter: collectorFilter,
                time: 120_000,
                componentType: ComponentType.Button
            });

            if (confirmation.customId.startsWith('ban/confirm')) {
                // Handle ban confirmation
                await confirmation.update({
                    content: `# Processing ban...\nMaking sure ${(await target).displayName} can't come back to cause chaos.\n-# This might take a moment while I work my magic.`,
                    components: [],
                    embeds: []
                });

                try {
                    await (await target).ban();
                    await interaction.followUp({
                        content: `# Got 'em!\n${(await target).displayName} has been successfully banned from the server.\n-# They won't be causing trouble anymore!`,
                        flags: MessageFlags.Ephemeral
                    });
                } catch (error) {
                    await interaction.followUp({
                        content: `# Oops!\nSomething went wrong while trying to ban this user.\n-# Maybe they left already? Or I don't have enough permissions?`,
                        flags: MessageFlags.Ephemeral
                    });
                }
            } else if (confirmation.customId.startsWith('ban/cancel')) {
                // Handle cancel
                await confirmation.update({
                    content: 'Ban operation cancelled.',
                    components: [],
                    embeds: []
                });
            }
        } catch (error) {
            // Collector ended due to timeout
            await interaction.editReply({
                content: `# Time's up!\nNo response received, so I'm not banning anyone.\n-# Maybe you changed your mind? That's cool too!`,
                components: [],
                embeds: []
            });
        }
    }
};