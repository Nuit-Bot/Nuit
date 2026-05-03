import type { NextFunction, Request, Response } from "express";
import { app } from "./main";
import type { User } from "@supabase/supabase-js";

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

app.get("/dashboard", requireAuth, (req, res) => {
    const user = req.session.supabaseSession!.user;
    const discordUser = userToDiscord(user);
    res.send(discordUser?.displayName);
});
