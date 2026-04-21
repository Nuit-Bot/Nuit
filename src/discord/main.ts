import { Client, IntentsBitField } from "discord.js";
import { scanModules, setupCommandsAndEvents } from "./utility/moduleLoader";
import { join } from "node:path";
import config from "../utility/config";
import which from "which";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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
                const regJSON = JSON.parse(regData);

                if (!Array.isArray(regJSON)) {
                    console.error(
                        `Registry at ${reg.path} is not a valid array.`,
                    );
                    continue;
                }

                for (const mod of regJSON as RegistryModule[]) {
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
                    continue;
                }

                const regJSON = await req.json();

                if (!Array.isArray(regJSON)) {
                    console.error(
                        `Registry at ${reg.raw} did not return a valid array.`,
                    );
                    continue;
                }

                for (const mod of regJSON as RegistryModule[]) {
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

        const lockPath = join(import.meta.dirname, "..", "..", "registry.lock");
        const registryModulesPath = join(
            import.meta.dirname,
            "..",
            "registry-modules",
        );

        const lockFile = await readFile(lockPath, "utf-8").catch(() => null);
        const lockModules: RegistryModule[] = lockFile
            ? JSON.parse(lockFile)
            : [];

        const toAdd = externalModules.filter(
            (m) => !lockModules.find((l) => l.id === m.id),
        );
        const toRemove = lockModules.filter(
            (m) => !externalModules.find((e) => e.id === m.id),
        );
        const toUpdate = externalModules.filter((m) => {
            const locked = lockModules.find((l) => l.id === m.id);
            return locked && locked.commit !== m.commit;
        });

        if (!toAdd.length && !toRemove.length && !toUpdate.length) {
            console.log("No changes to lockfile, finished.");
        } else {
            if (!existsSync(registryModulesPath)) {
                await mkdir(registryModulesPath);
            }

            let failed = false;

            for (const mod of toAdd) {
                const modPath = join(registryModulesPath, mod.id);
                try {
                    await execFileAsync(
                        "git",
                        ["clone", `${mod.repo}.git`, mod.id],
                        {
                            cwd: registryModulesPath,
                        },
                    );
                    await execFileAsync("git", ["checkout", mod.commit], {
                        cwd: modPath,
                    });
                    console.log(`Installed module ${mod.id} at ${mod.commit}.`);
                } catch (err) {
                    console.error(`Failed to install module ${mod.id}:`, err);
                    // clean up partial clone
                    await rm(modPath, { recursive: true, force: true });
                    failed = true;
                }
            }

            for (const mod of toUpdate) {
                const modPath = join(registryModulesPath, mod.id);
                try {
                    await execFileAsync("git", ["fetch"], { cwd: modPath });
                    await execFileAsync("git", ["checkout", mod.commit], {
                        cwd: modPath,
                    });
                    console.log(`Updated module ${mod.id} to ${mod.commit}.`);
                } catch (err) {
                    console.error(`Failed to update module ${mod.id}:`, err);
                    failed = true;
                }
            }

            for (const mod of toRemove) {
                const modPath = join(registryModulesPath, mod.id);
                try {
                    await rm(modPath, { recursive: true, force: true });
                    console.log(`Removed module ${mod.id}.`);
                } catch (err) {
                    console.error(`Failed to remove module ${mod.id}:`, err);
                    failed = true;
                }
            }

            if (!failed) {
                await writeFile(
                    lockPath,
                    JSON.stringify(externalModules),
                    "utf-8",
                );
            } else {
                console.error(
                    "Some module operations failed, lockfile was not updated.",
                );
            }
        }

        scanModules(join(import.meta.dirname, "..", "registry-modules"));
    }
}

scanModules(join(import.meta.dirname, "..", "modules"));
setupCommandsAndEvents();

client.login(process.env.DISCORD_TOKEN);
