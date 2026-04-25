import { Client, IntentsBitField } from "discord.js";
import {
    globalRegistry,
    pushCommandsToDiscord,
    scanModules,
    setupCommandsAndEvents,
} from "./utility/moduleLoader";
import { cleanMultiline } from "./utility/cleanMultiline";
import { join } from "node:path";
import config from "../utility/config";
import which from "which";
import { mkdir, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import chalk from "chalk";

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
        console.warn(
            cleanMultiline(`${chalk.yellow("Git is not found, skipping external modules.")}
            ${chalk.green("Fix")}: Install Git and make sure it is available in your PATH.`),
        );
    } else {
        const externalModules: RegistryModule[] = [];

        for (const reg of config.registries) {
            if (reg.path) {
                const regData = await readFile(reg.path, "utf-8");
                const regJSON = JSON.parse(regData);

                if (!Array.isArray(regJSON)) {
                    console.warn(
                        cleanMultiline(`${chalk.yellow(`Registry at ${reg.path} is not a valid array, skipping.`)}
                        ${chalk.green("Fix")}: Ensure the registry file exports a JSON array.
                        ${chalk.gray(
                            cleanMultiline(`Details:
                            - Path: ${reg.path}`),
                        )}`),
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
                    console.warn(
                        cleanMultiline(`${chalk.yellow(`Failed to fetch registry, skipping.`)}
                        ${chalk.green("Fix")}: Ensure the registry URL is reachable and returns a valid JSON array.
                        ${chalk.gray(
                            cleanMultiline(`Details:
                            - URL: ${reg.raw}
                            - Status: ${req.status} ${req.statusText}`),
                        )}`),
                    );
                    continue;
                }

                const regJSON = await req.json();

                if (!Array.isArray(regJSON)) {
                    console.warn(
                        cleanMultiline(`${chalk.yellow(`Registry at ${reg.raw} did not return a valid array, skipping.`)}
                        ${chalk.green("Fix")}: Ensure the registry URL returns a JSON array.
                        ${chalk.gray(
                            cleanMultiline(`Details:
                            - URL: ${reg.raw}`),
                        )}`),
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
                console.warn(
                    cleanMultiline(`${chalk.yellow("Registry entry has no valid source, skipping.")}
                    ${chalk.green("Fix")}: Each registry entry must have either a "path" or "raw" field.`),
                );
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
            console.log(chalk.green("External modules are up to date."));
        } else {
            await mkdir(registryModulesPath, { recursive: true });

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
                    console.log(
                        chalk.green(
                            `Installed module ${mod.id} at ${mod.commit}.`,
                        ),
                    );
                } catch (err) {
                    console.error(
                        cleanMultiline(`Failed to install module ${chalk.yellow(mod.id)}.
                        ${chalk.gray(
                            cleanMultiline(`Details:
                            - Repo: ${mod.repo}
                            - Commit: ${mod.commit}
                            - Error: ${err}`),
                        )}`),
                    );
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
                    console.log(
                        chalk.green(
                            `Updated module ${mod.id} to ${mod.commit}.`,
                        ),
                    );
                } catch (err) {
                    console.error(
                        cleanMultiline(`Failed to update module ${chalk.yellow(mod.id)}.
                        ${chalk.gray(
                            cleanMultiline(`Details:
                            - Commit: ${mod.commit}
                            - Error: ${err}`),
                        )}`),
                    );
                    failed = true;
                }
            }

            for (const mod of toRemove) {
                const modPath = join(registryModulesPath, mod.id);
                try {
                    await rm(modPath, { recursive: true, force: true });
                    console.log(chalk.green(`Removed module ${mod.id}.`));
                } catch (err) {
                    console.error(
                        cleanMultiline(`Failed to remove module ${chalk.yellow(mod.id)}.
                        ${chalk.gray(
                            cleanMultiline(`Details:
                            - Error: ${err}`),
                        )}`),
                    );
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
                console.warn(
                    chalk.yellow(
                        "Some module operations failed — lockfile was not updated.",
                    ),
                );
            }
        }

        const registryModules = await readdir(registryModulesPath).catch(
            () => null,
        );
        if (registryModules) {
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
