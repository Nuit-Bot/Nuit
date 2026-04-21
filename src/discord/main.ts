import { Client, IntentsBitField } from "discord.js";
import { scanModules, setupCommandsAndEvents } from "./utility/moduleLoader";
import { join } from "node:path";
import config from "../utility/config";
import which from "which";
import { readFile, writeFile } from "node:fs/promises";

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
    if (!(await which("git", { nothrow: true }))) {
        console.error("Git is not found, not installing external modules...");
    } else {
        const externalModules: RegistryModule[] = [];

        for (const reg of config.registries) {
            if (reg.path) {
                const regData = await readFile(reg.path, "utf-8");
                const regJSON = JSON.parse(regData) as RegistryModule[];

                for (const mod of regJSON) {
                    if (externalModules.find((m) => m.id === mod.id)) {
                        console.warn(
                            `Found 2 exact modules with ID "${mod.id}". Ignoring.`,
                        );
                        continue;
                    }
                    externalModules.push(mod);
                }
            } else if (reg.raw) {
                const req = await fetch(reg.raw);
                if (!req.ok) {
                    console.error(
                        `Request to ${reg.raw} was not OK: ${req.status} ${req.statusText}`,
                    );
                    continue; // was `return`, which would exit the whole block
                }

                const regJSON = (await req.json()) as RegistryModule[];

                for (const mod of regJSON) {
                    if (externalModules.find((m) => m.id === mod.id)) {
                        console.warn(
                            `Found 2 exact modules with ID "${mod.id}". Ignoring.`,
                        );
                        continue;
                    }
                    externalModules.push(mod);
                }
            } else {
                console.error("Registry is an incorrect type.");
            }
        }

        await writeFile(
            join(import.meta.dirname, "..", "..", "registry.lock"),
            JSON.stringify(externalModules),
            "utf-8",
        );
    }
}

// Scan after external modules are resolved/installed
scanModules(join(import.meta.dirname, "..", "modules"));
setupCommandsAndEvents();

client.login(process.env.DISCORD_TOKEN);
