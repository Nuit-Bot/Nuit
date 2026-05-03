import type { NextFunction, Request, Response } from "express";
import { app } from "./main";
import type { User } from "@supabase/supabase-js";
import path from "node:path";
import { PermissionsBitField } from "discord.js";
import { client } from "../discord/main";
import { TtlCache } from "../utility/cache";

export interface DiscordRESTGuild {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: string;
    features: string[];
}

export const mutualGuildsCache = new TtlCache<string, []>(90_000);

export async function getMutualGuilds(providerToken: string, userId: string) {
    let guilds;

    if (!mutualGuildsCache.get(userId)) {
        const response = await fetch(
            "https://discord.com/api/v10/users/@me/guilds",
            {
                headers: { Authorization: `Bearer ${providerToken}` },
            },
        );

        guilds = await response.json();
        mutualGuildsCache.set(userId, guilds);
    } else {
        guilds = mutualGuildsCache.get(userId);
    }

    const botGuildIds = new Set(client.guilds.cache.keys());

    return guilds.filter((g: DiscordRESTGuild) => {
        const perms = BigInt(g.permissions);
        const hasManageGuild =
            (perms & PermissionsBitField.Flags.ManageGuild) !== 0n;
        return hasManageGuild && botGuildIds.has(g.id);
    });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (!req.session.supabaseSession)
        return res.redirect("/auth/discord/login");
    next();
}

export function userToDiscord(user: User) {
    if (!user) throw new Error("User does not exist");

    return {
        displayName: user.user_metadata.custom_claims.global_name,
        username: user.user_metadata.full_name,
        avatarUrl: user.user_metadata.avatar_url,
        id: user.user_metadata.provider_id,
    };
}

app.get("/dashboard/:guildId/:module", (req, res) => {
    res.sendFile(path.join(import.meta.dirname, "..", "config", "index.html"));
});

app.get("/api/users/@me", (req, res) => {
    if (!req.session.supabaseSession?.user) {
        return res.status(401).send("Unauthorized");
    }
    res.json(userToDiscord(req.session.supabaseSession?.user!));
});

app.get("/api/guilds/common", async (req, res) => {
    if (!req.session.supabaseSession?.user) {
        return res.status(401).send("Unauthorized");
    }

    const providerToken = req.session.supabaseSession?.provider_token;
    if (!providerToken) return res.status(401).send("No provider token");

    let mutualGuilds;

    const user = userToDiscord(req.session.supabaseSession.user);

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
