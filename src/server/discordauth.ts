import { app } from "./main.ts";
import { getSupabaseClient } from "../utility/supabase.ts";

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
    const { error } =
        await getSupabaseClient().auth.exchangeCodeForSession(code);
    if (error) return res.redirect("/");
    res.redirect("/dashboard");
});

app.get("/auth/logout", async (_req, res) => {
    await getSupabaseClient().auth.signOut();
    res.redirect("/");
});
