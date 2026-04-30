import { Client, IntentsBitField } from "discord.js";
import {
    globalRegistry,
    pushCommandsToDiscord,
    scanModules,
    setupCommandsAndEvents,
} from "./utility/moduleLoader";
import { resolveExternalModules, syncExternalModules, getInstalledModuleDirs } from "./utility/registryManager";
import { cleanMultiline } from "./utility/cleanMultiline";
import { join } from "node:path";
import config from "../utility/config";
import chalk from "chalk";

export const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
    ],
});

export interface RegistryModule {
    id: string;
    repo: string;
    author: string;
    commit: string;
}

if (config.host.allow_external_modules) {
    if (!(await Bun.which("git"))) {
        console.warn(
            cleanMultiline(`${chalk.yellow("Git is not found, skipping external modules.")}
            ${chalk.green("Fix")}: Install Git and make sure it is available in your PATH.`),
        );
    } else {
        const registryModulesPath = join(import.meta.dirname, "..", "..", "registry-modules");
        const lockPath = join(import.meta.dirname, "..", "..", "registry.lock");

        const externalModules = await resolveExternalModules(config.registries);
        await syncExternalModules(externalModules, registryModulesPath, lockPath);

        const installedDirs = await getInstalledModuleDirs(registryModulesPath);
        if (installedDirs) {
            await scanModules(registryModulesPath);
        }
    }
}

await scanModules(join(import.meta.dirname, "..", "modules"));
await setupCommandsAndEvents();
if (process.argv.includes("--register")) {
    await pushCommandsToDiscord(globalRegistry.commands);
}

client.login(process.env.DISCORD_TOKEN);
