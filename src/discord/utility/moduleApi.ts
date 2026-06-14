import type { Json, NuitAPI } from "@nuit-bot/api";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/main";
import { guildModulesCache } from "./moduleLoader";
import { guild_modules } from "../../db/schema";

export function moduleSlug(moduleName: string) {
    return moduleName
        .replace(/^@/, "")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase();
}

export function moduleTableName(moduleName: string, name: string) {
    const suffix = name
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase();

    return `module_${moduleSlug(moduleName)}_${suffix}`;
}

export function createModuleApi(api: NuitAPI, moduleName: string): NuitAPI {
    return Object.assign(api, {
        async getGuildConfig<T = Json>(guildId: string): Promise<T | null> {
            const [row] = await db
                .select({ config: guild_modules.config })
                .from(guild_modules)
                .where(
                    and(
                        eq(guild_modules.guild_id, guildId),
                        eq(guild_modules.module_id, moduleName),
                    ),
                )
                .limit(1);

            return (row?.config as T | null) ?? null;
        },

        async setGuildConfig<T = Json>(guildId: string, config: T) {
            await db
                .insert(guild_modules)
                .values({
                    guild_id: guildId,
                    module_id: moduleName,
                    config: config as Json,
                })
                .onConflictDoUpdate({
                    target: [guild_modules.guild_id, guild_modules.module_id],
                    set: {
                        config: config as Json,
                        updated_at: sql`now()`,
                    },
                });

            guildModulesCache.delete(guildId);
        },

        async updateGuildConfig<T = Json>(
            guildId: string,
            patch: Partial<T>,
        ): Promise<T> {
            const current =
                ((await this.getGuildConfig<T>(guildId)) as Record<
                    string,
                    unknown
                > | null) ?? {};
            const next = { ...current, ...patch } as T;

            await this.setGuildConfig(guildId, next);
            return next;
        },

        async isEnabled(guildId: string): Promise<boolean> {
            const [row] = await db
                .select({ enabled: guild_modules.enabled })
                .from(guild_modules)
                .where(
                    and(
                        eq(guild_modules.guild_id, guildId),
                        eq(guild_modules.module_id, moduleName),
                    ),
                )
                .limit(1);

            return row?.enabled !== false;
        },

        tableName(name: string) {
            return moduleTableName(moduleName, name);
        },
    });
}
