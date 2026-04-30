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

function isValidRegistryModule(value: unknown): value is RegistryModule {
    if (typeof value !== "object" || value === null) return false;
    const m = value as Record<string, unknown>;
    return (
        typeof m.id === "string" &&
        m.id.length > 0 &&
        typeof m.repo === "string" &&
        m.repo.length > 0 &&
        typeof m.commit === "string" &&
        m.commit.length > 0
    );
}

const FETCH_TIMEOUT_MS = 10_000;

if (config.host.allow_external_modules) {
    if (!(await Bun.which("git"))) {
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

                const seenIdsLocal = new Set(externalModules.map((m) => m.id));
                for (const entry of regJSON as unknown[]) {
                    if (!isValidRegistryModule(entry)) {
                        console.warn(
                            chalk.yellow(
                                `Registry at ${reg.path} contains an invalid entry, skipping it.`,
                            ) +
                                `\n${chalk.gray(`Entry: ${JSON.stringify(entry)}`)}`,
                        );
                        continue;
                    }
                    if (seenIdsLocal.has(entry.id)) {
                        console.warn(
                            `Found 2 exact modules with ID "${entry.id}". Ignoring.`,
                        );
                        continue;
                    }
                    seenIdsLocal.add(entry.id);
                    externalModules.push(entry);
                }
            } else if (reg.raw) {
                const controller = new AbortController();
                const timeoutId = setTimeout(
                    () => controller.abort(),
                    FETCH_TIMEOUT_MS,
                );
                let req: Response;
                try {
                    req = await fetch(reg.raw, { signal: controller.signal });
                } catch (err) {
                    console.warn(
                        cleanMultiline(`${chalk.yellow(`Failed to fetch registry (network error or timeout), skipping.`)}
                        ${chalk.green("Fix")}: Ensure the registry URL is reachable within ${FETCH_TIMEOUT_MS}ms.
                        ${chalk.gray(
                            cleanMultiline(`Details:
                            - URL: ${reg.raw}
                            - Error: ${err}`),
                        )}`),
                    );
                    continue;
                } finally {
                    clearTimeout(timeoutId);
                }
                req = req!; // never reached, satisfies TS narrowing
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

                const seenIds = new Set(externalModules.map((m) => m.id));
                for (const entry of regJSON as unknown[]) {
                    if (!isValidRegistryModule(entry)) {
                        console.warn(
                            chalk.yellow(
                                `Registry at ${reg.raw} contains an invalid entry, skipping it.`,
                            ) +
                                `\n${chalk.gray(`Entry: ${JSON.stringify(entry)}`)}`,
                        );
                        continue;
                    }
                    if (seenIds.has(entry.id)) {
                        console.warn(
                            `Found 2 exact modules with ID "${entry.id}". Ignoring.`,
                        );
                        continue;
                    }
                    seenIds.add(entry.id);
                    externalModules.push(entry);
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

            const successfulAdds: RegistryModule[] = [];
            const failedAddIds = new Set<string>();
            const successfulUpdateIds = new Set<string>();
            const successfulRemoveIds = new Set<string>();

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
                    successfulAdds.push(mod);
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
                    failedAddIds.add(mod.id);
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
                    successfulUpdateIds.add(mod.id);
                } catch (err) {
                    console.error(
                        cleanMultiline(`Failed to update module ${chalk.yellow(mod.id)}.
                        ${chalk.gray(
                            cleanMultiline(`Details:
                            - Commit: ${mod.commit}
                            - Error: ${err}`),
                        )}`),
                    );
                }
            }

            for (const mod of toRemove) {
                const modPath = join(registryModulesPath, mod.id);
                try {
                    await rm(modPath, { recursive: true, force: true });
                    console.log(chalk.green(`Removed module ${mod.id}.`));
                    successfulRemoveIds.add(mod.id);
                } catch (err) {
                    console.error(
                        cleanMultiline(`Failed to remove module ${chalk.yellow(mod.id)}.
                        ${chalk.gray(
                            cleanMultiline(`Details:
                            - Error: ${err}`),
                        )}`),
                    );
                }
            }

            // Build the accurate post-operation lockfile state from what actually succeeded.
            const newLockState: RegistryModule[] = [
                // Kept: previously locked modules that weren't removed successfully
                ...lockModules.filter(
                    (m) =>
                        !successfulRemoveIds.has(m.id) &&
                        !toUpdate.find((u) => u.id === m.id) &&
                        !toAdd.find((a) => a.id === m.id),
                ),
                // Updated: replace old commit with new for those that succeeded
                ...toUpdate
                    .filter((m) => successfulUpdateIds.has(m.id))
                    .map((m) => ({ ...m })),
                // Carry old state for failed updates
                ...toUpdate
                    .filter((m) => !successfulUpdateIds.has(m.id))
                    .map((m) => lockModules.find((l) => l.id === m.id)!),
                // Newly added modules that succeeded
                ...successfulAdds,
            ];

            await writeFile(lockPath, JSON.stringify(newLockState), "utf-8");

            const anyFailed =
                failedAddIds.size > 0 ||
                toUpdate.some((m) => !successfulUpdateIds.has(m.id)) ||
                toRemove.some((m) => !successfulRemoveIds.has(m.id));

            if (anyFailed) {
                console.warn(
                    chalk.yellow(
                        "Some module operations failed — lockfile reflects partial progress.",
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
