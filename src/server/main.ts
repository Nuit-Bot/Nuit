import chalk from "chalk";
import express from "express";
import path from "node:path";

const app = express();

app.use(express.static(path.join(import.meta.dirname, "..", "web")));

app.listen(process.env.PORT || 8080, () => {
    console.log(
        chalk.green(`[Server] Running on port ${process.env.PORT || 8080}`),
    );
});
