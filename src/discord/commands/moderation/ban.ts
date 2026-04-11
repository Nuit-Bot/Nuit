import { CommandInteraction, MessageFlags, PermissionsBitField, SlashCommandBuilder } from "discord.js";

export default {
    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Bans a selected user")
        .setDescriptionLocalization("fr", "Bannis un utilisateur sélectionné")
        .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers)
        .addUserOption(option => option.setName("user")
            .setDescription("The user to ban")
            .setDescriptionLocalization("fr", "L'utilisateur à bannir ")
        ),

    async execute(interaction: CommandInteraction) {
        // Defer the reply / show a loading message to the user
        // It's also ephemeral, so it only shows to the user who ran the command
        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        // We check permissions incase `.setDefaultMemberPermissions` has a weird use case or the command is ran incorrectly
        const permissions = interaction.member!.permissions as PermissionsBitField;
        if (!permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return await interaction.editReply({
                content: `# Well that's weird!
                You shouldn't be able to run that command unless you have some sort of trick up your sleeve.
                -# But I guess it's okay, since you can't ban anyone anyway.` });
        }
    }
};