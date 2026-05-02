import chalk from "chalk";
import express from "express";
import path from "node:path";
import session from "express-session";

export const app = express();

app.use(
    session({
        secret: process.env.SESSION_SECRET!,
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 days
    }),
);

app.use(express.static(path.join(import.meta.dirname, "..", "web")));

app.listen(process.env.PORT || 8080, async () => {
    console.log(
        chalk.green(`[Server] Running on port ${process.env.PORT || 8080}`),
    );

    await import("./discordauth");
    await import("./dashboard");
});
