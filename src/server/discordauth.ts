import { app } from "./main.ts";
import { getSupabaseClient } from "../utility/supabase.ts";
import type { Session as SupabaseSession } from "@supabase/supabase-js";

declare module "express-session" {
    interface SessionData {
        supabaseSession: SupabaseSession;
    }
}

app.get("/auth/discord/login", async (_req, res) => {
    const { data, error } = await getSupabaseClient().auth.signInWithOAuth({
        provider: "discord",
        options: {
            redirectTo: process.env.DISCORD_CALLBACK_URL,
            scopes: "identify guilds email",
        },
    });
    if (error || !data.url) return res.status(500).send(error?.message);
    res.redirect(data.url);
});

app.get("/auth/discord/callback", async (req, res) => {
    const code = req.query.code as string;
    if (!code) return res.redirect("/");

    const { data, error } =
        await getSupabaseClient().auth.exchangeCodeForSession(code);
    if (error || !data.session) return res.redirect("/");

    req.session.supabaseSession = data.session;
    res.redirect("/dashboard");
});

app.get("/auth/logout", async (req, res) => {
    await getSupabaseClient().auth.signOut();
    req.session.destroy(() => res.redirect("/"));
});
