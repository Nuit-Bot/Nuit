import chalk from "chalk";
import express from "express";
import path from "node:path";

export const app = express();

app.use(express.static(path.join(import.meta.dirname, "..", "web")));

app.listen(process.env.PORT || 8080, async () => {
    console.log(
        chalk.green(`[Server] Running on port ${process.env.PORT || 8080}`),
    );

    await import("./discordauth");
});
