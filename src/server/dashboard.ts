import type { NextFunction, Request, Response } from "express";
import { app } from "./main";
import { fromNodeHeaders } from "better-auth/node";
import type { Json } from "@nuit-bot/api";
import { PermissionsBitField } from "discord.js";
import { auth } from "../lib/auth";
import { client } from "../discord/main";
import {
    globalRegistry,
    guildModulesCache,
    modulePageSchemas,
    modulePages,
} from "../discord/utility/moduleLoader";
import { TtlCache } from "../utility/cache";
import { db } from "../db/main";
import { guild_modules, guilds } from "../db/schema";
import { and, eq } from "drizzle-orm";

export interface DiscordRESTGuild {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: string;
    features: string[];
}

export const mutualGuildsCache = new TtlCache<string, DiscordRESTGuild[]>(90_000);
export const guildCache = new TtlCache<string, object>(90_000);

interface DashboardAuthUser {
    id: string;
    name: string;
    image?: string | null;
}

function getModuleSchema(moduleId: string) {
    if (modulePages.has(moduleId)) {
        return modulePageSchemas.get(moduleId) ?? [];
    }

    return globalRegistry.config.filter((field) => field.module === moduleId);
}

function getAllModuleIds() {
    return Array.from(
        new Set([
            ...globalRegistry.commands.map((command) => command.module),
            ...globalRegistry.events.map((event) => event.module),
            ...globalRegistry.config.map((field) => field.module),
            ...modulePages,
        ]),
    );
}

function formatModuleName(moduleId: string) {
    return (
        moduleId
            .split("/")
            .at(-1)
            ?.replace(/^module-/, "")
            .split("-")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ") ?? moduleId
    );
}

function getModuleKind(moduleId: string) {
    return (
        globalRegistry.commands.find((command) => command.module === moduleId)
            ?.kind ?? null
    );
}

function moduleExists(moduleId: string) {
    return (
        modulePages.has(moduleId) ||
        globalRegistry.config.some((field) => field.module === moduleId) ||
        globalRegistry.commands.some(
            (command) => command.module === moduleId,
        ) ||
        globalRegistry.events.some((event) => event.module === moduleId)
    );
}

function isJsonObject(value: Json | undefined): value is Record<string, Json> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function getGuildModulesOverview(guildId: string) {
    let storedModules = guildModulesCache.get(guildId);

    if (!storedModules) {
        const rows = await db
            .select({
                guild_id: guild_modules.guild_id,
                module_id: guild_modules.module_id,
                enabled: guild_modules.enabled,
                config: guild_modules.config,
                updated_at: guild_modules.updated_at,
            })
            .from(guild_modules)
            .where(eq(guild_modules.guild_id, guildId));
        storedModules = rows.map((row) => ({
            ...row,
            config: (row.config as Json | null) ?? null,
        }));
        guildModulesCache.set(guildId, storedModules);
    }

    return getAllModuleIds()
        .filter((moduleId) => getModuleKind(moduleId) !== "internal")
        .map((moduleId) => {
            const stored = storedModules.find(
                (entry) => entry.module_id === moduleId,
            );
            const fields = getModuleSchema(moduleId);
            const hasPage = modulePages.has(moduleId);

            return {
                id: moduleId,
                name: formatModuleName(moduleId),
                kind: getModuleKind(moduleId),
                enabled: stored?.enabled ?? false,
                configurable: fields.length > 0 || hasPage,
                hasPage,
                commandCount: globalRegistry.commands.filter(
                    (command) => command.module === moduleId,
                ).length,
                eventCount: globalRegistry.events.filter(
                    (event) => event.module === moduleId,
                ).length,
                fieldCount: fields.length,
                updatedAt: stored?.updated_at ?? null,
            };
        });
}

export async function getMutualGuilds(providerToken: string, userId: string) {
    let guilds: DiscordRESTGuild[];

    if (!mutualGuildsCache.get(userId)) {
        const response = await fetch(
            "https://discord.com/api/v10/users/@me/guilds",
            {
                headers: { Authorization: `Bearer ${providerToken}` },
            },
        );

        if (!response.ok) {
            throw new Error(
                `Discord guild fetch failed with status ${String(response.status)}`,
            );
        }

        const payload = await response.json();

        if (!Array.isArray(payload)) {
            throw new Error("Discord guild fetch returned an unexpected payload");
        }

        guilds = payload as DiscordRESTGuild[];
        mutualGuildsCache.set(userId, guilds);
    } else {
        guilds = mutualGuildsCache.get(userId) as DiscordRESTGuild[];
    }

    const botGuildIds = new Set(client.guilds.cache.keys());

    return guilds.filter((g: DiscordRESTGuild) => {
        const perms = BigInt(g.permissions);
        const hasManageGuild =
            (perms & PermissionsBitField.Flags.ManageGuild) !== 0n;
        return hasManageGuild && botGuildIds.has(g.id);
    });
}

async function getAuthSession(req: Request) {
    return auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
}

async function getDiscordAccessToken(req: Request) {
    const tokens = await auth.api.getAccessToken({
        headers: fromNodeHeaders(req.headers),
        body: {
            providerId: "discord",
        },
    });

    return tokens.accessToken;
}

export async function requireAuth(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    const session = await getAuthSession(req);

    if (!session) {
        return res.redirect("/auth/discord/login");
    }

    next();
}

export function userToDiscord(user: DashboardAuthUser) {
    if (!user) throw new Error("User does not exist");

    return {
        displayName: user.name,
        username: user.name,
        avatarUrl: user.image ?? null,
        id: user.id,
    };
}

export async function hasAccess(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    const guildId = req.params.guildId;
    if (typeof guildId !== "string") throw new Error("Missing guild ID");

    const session = await getAuthSession(req);

    if (!session) {
        return res.redirect("/auth/discord/login");
    }

    const mutual = await getMutualGuilds(
        await getDiscordAccessToken(req),
        userToDiscord(session.user).id,
    );

    if (mutual.some((g: DiscordRESTGuild) => g.id === guildId)) {
        next();
    } else {
        return res.redirect("/dashboard");
    }
}

app.get(
    "/api/guild/:guildId/:module/config",
    requireAuth,
    hasAccess,
    async (req, res) => {
        const { guildId, module: moduleId } = req.params;

        if (typeof guildId !== "string" || typeof moduleId !== "string") {
            return res.status(400).json({ error: "Missing route params" });
        }

        if (!moduleExists(moduleId)) {
            return res.status(404).json({ error: "Unknown module" });
        }

        const schema = getModuleSchema(moduleId);

        try {
            const [data] = await db
                .select({
                    config: guild_modules.config,
                    enabled: guild_modules.enabled,
                    updated_at: guild_modules.updated_at,
                })
                .from(guild_modules)
                .where(
                    and(
                        eq(guild_modules.guild_id, guildId),
                        eq(guild_modules.module_id, moduleId),
                    ),
                )
                .limit(1);

            const config = data?.config as Json | undefined;

            res.json({
                guildId,
                module: moduleId,
                schema,
                enabled: data?.enabled ?? false,
                config: isJsonObject(config)
                    ? (config as Record<string, Json>)
                    : {},
                updatedAt: data?.updated_at ?? null,
                hasPage: modulePages.has(moduleId),
            });
        } catch (error) {
            console.error("Failed to fetch module config", error);
            return res
                .status(500)
                .json({ error: "Failed to fetch module config" });
        }
    },
);

app.put(
    "/api/guild/:guildId/:module/config",
    requireAuth,
    hasAccess,
    async (
        req: Request<
            { guildId: string; module: string },
            any,
            { config?: Json }
        >,
        res,
    ) => {
        const { guildId, module: moduleId } = req.params;
        const nextConfig = req.body?.config;

        if (typeof guildId !== "string" || typeof moduleId !== "string") {
            return res.status(400).json({ error: "Missing route params" });
        }

        if (!moduleExists(moduleId)) {
            return res.status(404).json({ error: "Unknown module" });
        }

        if (!isJsonObject(nextConfig)) {
            return res.status(400).json({
                error: "Expected body shape { config: { ... } }",
            });
        }

        try {
            const [existing] = await db
                .select({ enabled: guild_modules.enabled })
                .from(guild_modules)
                .where(
                    and(
                        eq(guild_modules.guild_id, guildId),
                        eq(guild_modules.module_id, moduleId),
                    ),
                )
                .limit(1);

            const [data] = await db
                .insert(guild_modules)
                .values({
                    guild_id: guildId,
                    module_id: moduleId,
                    config: nextConfig,
                    enabled: existing?.enabled ?? false,
                })
                .onConflictDoUpdate({
                    target: [guild_modules.guild_id, guild_modules.module_id],
                    set: {
                        config: nextConfig,
                        enabled: existing?.enabled ?? false,
                        updated_at: new Date(),
                    },
                })
                .returning({
                    config: guild_modules.config,
                    enabled: guild_modules.enabled,
                    updated_at: guild_modules.updated_at,
                });

            if (!data) {
                throw new Error("Module config upsert returned no row");
            }

            const config = data.config as Json | undefined;

            guildModulesCache.delete(guildId);

            res.json({
                guildId,
                module: moduleId,
                schema: getModuleSchema(moduleId),
                enabled: data.enabled,
                config: isJsonObject(config)
                    ? (config as Record<string, Json>)
                    : {},
                updatedAt: data.updated_at,
                hasPage: modulePages.has(moduleId),
            });
        } catch (error) {
            console.error("Failed to update module config", error);
            return res
                .status(500)
                .json({ error: "Failed to update module config" });
        }
    },
);

app.put(
    "/api/guild/:guildId/:module/enabled",
    requireAuth,
    hasAccess,
    async (
        req: Request<
            { guildId: string; module: string },
            any,
            { enabled: boolean }
        >,
        res,
    ) => {
        const { guildId, module: moduleId } = req.params;
        const { enabled } = req.body;

        if (typeof guildId !== "string" || typeof moduleId !== "string") {
            return res.status(400).json({ error: "Missing route params" });
        }

        if (!moduleExists(moduleId)) {
            return res.status(404).json({ error: "Unknown module" });
        }

        if (typeof enabled !== "boolean") {
            return res
                .status(400)
                .json({ error: "Expected body shape { enabled: boolean }" });
        }

        try {
            const [existing] = await db
                .select({ config: guild_modules.config })
                .from(guild_modules)
                .where(
                    and(
                        eq(guild_modules.guild_id, guildId),
                        eq(guild_modules.module_id, moduleId),
                    ),
                )
                .limit(1);

            const [data] = await db
                .insert(guild_modules)
                .values({
                    guild_id: guildId,
                    module_id: moduleId,
                    enabled,
                    config: (existing?.config as Json | undefined) ?? {},
                })
                .onConflictDoUpdate({
                    target: [guild_modules.guild_id, guild_modules.module_id],
                    set: {
                        enabled,
                        config: (existing?.config as Json | undefined) ?? {},
                        updated_at: new Date(),
                    },
                })
                .returning({
                    enabled: guild_modules.enabled,
                    updated_at: guild_modules.updated_at,
                });

            if (!data) {
                throw new Error("Module status upsert returned no row");
            }

            guildModulesCache.delete(guildId);

            res.json({
                guildId,
                module: moduleId,
                enabled: data.enabled,
                updatedAt: data.updated_at,
            });
        } catch (error) {
            console.error("Failed to update module status", error);
            return res
                .status(500)
                .json({ error: "Failed to update module status" });
        }
    },
);

app.get(
    "/api/guild/:guildId/modules",
    requireAuth,
    hasAccess,
    async (req, res) => {
        const { guildId } = req.params;

        if (typeof guildId !== "string") {
            return res.status(400).json({ error: "Missing route params" });
        }

        try {
            const modules = await getGuildModulesOverview(guildId);
            return res.json(modules);
        } catch (error) {
            console.error("Failed to fetch guild modules overview", error);
            return res
                .status(500)
                .json({ error: "Failed to fetch guild modules" });
        }
    },
);

app.get("/api/users/@me", (req, res) => {
    getAuthSession(req)
        .then((session) => {
            if (!session?.user) {
                return res.status(401).send("Unauthorized");
            }

            return res.json(userToDiscord(session.user));
        })
        .catch((error) => {
            console.error("Failed to fetch current user", error);
            return res.status(500).send("Internal Server Error");
        });
});

app.get("/api/guilds/common", requireAuth, async (req, res) => {
    const session = await getAuthSession(req);

    if (!session?.user) {
        return res.status(401).send("Unauthorized");
    }

    const providerToken = await getDiscordAccessToken(req);
    if (!providerToken) return res.status(401).send("No provider token");

    let mutualGuilds;

    const user = userToDiscord(session.user);

    try {
        mutualGuilds = await getMutualGuilds(providerToken, user.id);
    } catch (err) {
        res.status(500).send("Internal Server Error");
        return console.error(
            "Something went wrong when fetching mutual guilds",
            err,
        );
    }

    res.json(mutualGuilds);
});

app.get("/api/guild/:guildId", requireAuth, hasAccess, async (req, res) => {
    const { guildId } = req.params;

    const cached = guildCache.get(guildId as string);
    if (cached) return res.json(cached);

    const guild: any = (await client.guilds.fetch(guildId as string)).toJSON();

    const [guildConfig] = await db
        .select({ config: guilds.config })
        .from(guilds)
        .where(eq(guilds.guild_id, String(guildId)))
        .limit(1);

    const formattedGuild = {
        id: guild.id,
        name: guild.name,
        iconURL: guild.iconURL,
        members: guild.members,
        channels: guild.channels,
        bans: guild.bans,
        roles: guild.roles,
        invites: guild.invites,
        autoModerationRules: guild.autoModerationRules,
        shardId: guild.shardId,
        splash: guild.splash,
        banner: guild.banner,
        description: guild.description,
        vanityURLCode: guild.vanityURLCode,
        memberCount: guild.memberCount,
        large: guild.large,
        botJoinedTimestamp: guild.joinedTimestamp,
        rulesChannelId: guild.rulesChannelId,
        updateChannelId: guild.publicUpdatesChannelId,
        locale: guild.preferredLocale,
        ownerId: guild.ownerId,
        emojis: guild.emojis,
        stickers: guild.stickers,
        createdTimestamp: guild.createdTimestamp,
        nameAcronym: guild.nameAcronym,
        guildConfig,
    };

    guildCache.set(guildId as string, formattedGuild as object);

    res.json(formattedGuild);
});
