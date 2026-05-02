import type { NextFunction, Request, Response } from "express";
import { app } from "./main";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (!req.session.supabaseSession)
        return res.redirect("/auth/discord/login");
    next();
}

app.get("/dashboard", requireAuth, (req, res) => {
    const user = req.session.supabaseSession!.user;
    res.send(`Hello ${user.user_metadata.full_name}`);
});
