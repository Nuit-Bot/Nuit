import {
    pgTable,
    text,
    boolean,
    jsonb,
    timestamp,
    primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const guilds = pgTable("guilds", {
    guild_id: text("guild_id").primaryKey(),
    joined_at: timestamp("joined_at", { withTimezone: true }).default(
        sql`now()`,
    ),
    locale: text("locale").default("en-US"),
    config: jsonb("config").default(sql`'{}'::jsonb`),
    // Whether or not the guild is available, mainly when the bot gets kicked from it.
    available: boolean("available").default(true),
});

export const guild_modules = pgTable(
    "guild_modules",
    {
        guild_id: text("guild_id")
            .notNull()
            .references(() => guilds.guild_id),
        module_id: text("module_id").notNull(),
        enabled: boolean("enabled").default(true),
        config: jsonb("config").default(sql`'{}'::jsonb`),
        updated_at: timestamp("updated_at", { withTimezone: true }).default(
            sql`now()`,
        ),
    },
    (t) => [primaryKey({ columns: [t.guild_id, t.module_id] })],
);

export const module_runtime_state = pgTable("module_runtime_state", {
    key: text("key").primaryKey(),
    value: jsonb("value").default(sql`'{}'::jsonb`),
    updated_at: timestamp("updated_at", { withTimezone: true }).default(
        sql`now()`,
    ),
});
