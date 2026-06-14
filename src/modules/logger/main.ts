import type { ModuleContext } from "@nuit-bot/api";
import { EmbedBuilder, type TextChannel } from "discord.js";

type LogPayload = {
    message: string;
    guildId: string;
    title?: string;
    level?: "info" | "warning" | "error";
};

type LoggerConfig = {
    channelId?: string;
};

declare module "@nuit-bot/api" {
    interface MessageRegistry {
        "logger:log": LogPayload;
    }
}

async function getLogChannelId(ctx: ModuleContext, guildId: string) {
    if (!(await ctx.api.isEnabled(guildId))) return;

    const loggerConfig = await ctx.api.getGuildConfig<LoggerConfig>(guildId);
    if (!loggerConfig) return;
    if (!loggerConfig.channelId) return;

    return loggerConfig.channelId;
}

export async function setup(ctx: ModuleContext) {
    await ctx.bus.on("logger:log", async (payload: LogPayload) => {
        const channelId = await getLogChannelId(ctx, payload.guildId);

        if (!channelId) return;

        let logChannel: TextChannel | undefined;

        try {
            logChannel = (await ctx.client.channels.fetch(channelId)) as
                | TextChannel
                | undefined;
        } catch (err) {
            return;
        }

        if (!logChannel) return;

        const levelColors: Record<string, number> = {
            info: 0x3498db,
            warning: 0xf1c40f,
            error: 0xe74c3c,
        };

        const logEmbed = new EmbedBuilder()
            .setTitle(payload.title ?? "Log")
            .setDescription(payload.message)
            .setColor(levelColors[payload.level ?? "info"] ?? 0x3498db);

        await logChannel.send({ embeds: [logEmbed] });
    });

    ctx.api.registerConfig([
        {
            key: "channelId",
            label: "Log Channel ID",
            type: "channel",
            description: "Channel used for logging",
            optional: true,
            default: undefined,
        },
    ]);
}
