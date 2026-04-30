import type { RegistryModule } from "../main";
import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cleanMultiline } from "./cleanMultiline";
import chalk from "chalk";

const execFileAsync = promisify(execFile);

const FETCH_TIMEOUT_MS = 10_000;

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

async function fetchRegistryFromUrl(url: string): Promise<RegistryModule[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res: Response;
    try {
        res = await fetch(url, { signal: controller.signal });
    } catch (err) {
        console.warn(
            cleanMultiline(`${chalk.yellow("Failed to fetch registry (network error or timeout), skipping.")}
            ${chalk.green("Fix")}: Ensure the registry URL is reachable within ${FETCH_TIMEOUT_MS}ms.
            ${chalk.gray(cleanMultiline(`Details:\n- URL: ${url}\n- Error: ${err}`))}`),
        );
        return [];
    } finally {
        clearTimeout(timeoutId);
    }

    if (!res.ok) {
        console.warn(
            cleanMultiline(`${chalk.yellow("Failed to fetch registry, skipping.")}
            ${chalk.green("Fix")}: Ensure the registry URL is reachable and returns a valid JSON array.
            ${chalk.gray(cleanMultiline(`Details:\n- URL: ${url}\n- Status: ${res.status} ${res.statusText}`))}`),
        );
        return [];
    }

    const json = await res.json();
    if (!Array.isArray(json)) {
        console.warn(
            cleanMultiline(`${chalk.yellow(`Registry at ${url} did not return a valid array, skipping.`)}
            ${chalk.green("Fix")}: Ensure the registry URL returns a JSON array.
            ${chalk.gray(`Details:\n- URL: ${url}`)}`),
        );
        return [];
    }

    return parseRegistryEntries(json, url);
}

async function fetchRegistryFromPath(path: string): Promise<RegistryModule[]> {
    const raw = await readFile(path, "utf-8").catch(() => null);
    if (raw === null) {
        console.warn(chalk.yellow(`Could not read registry file at ${path}, skipping.`));
        return [];
    }

    let json: unknown;
    try {
        json = JSON.parse(raw);
    } catch {
        console.warn(
            cleanMultiline(`${chalk.yellow(`Registry at ${path} contains invalid JSON, skipping.`)}
            ${chalk.green("Fix")}: Ensure the registry file contains a valid JSON array.`),
        );
        return [];
    }

    if (!Array.isArray(json)) {
        console.warn(
            cleanMultiline(`${chalk.yellow(`Registry at ${path} is not a valid array, skipping.`)}
            ${chalk.green("Fix")}: Ensure the registry file exports a JSON array.\n${chalk.gray(`Details:\n- Path: ${path}`)}`),
        );
        return [];
    }

    return parseRegistryEntries(json, path);
}

function parseRegistryEntries(entries: unknown[], source: string): RegistryModule[] {
    const seen = new Set<string>();
    const result: RegistryModule[] = [];

    for (const entry of entries) {
        if (!isValidRegistryModule(entry)) {
            console.warn(
                chalk.yellow(`Registry at ${source} contains an invalid entry, skipping it.`) +
                `\n${chalk.gray(`Entry: ${JSON.stringify(entry)}`)}`,
            );
            continue;
        }
        if (seen.has(entry.id)) {
            console.warn(`Found 2 exact modules with ID "${entry.id}". Ignoring.`);
            continue;
        }
        seen.add(entry.id);
        result.push(entry);
    }

    return result;
}

export async function resolveExternalModules(
    registries: Array<{ raw?: string; path?: string }>,
): Promise<RegistryModule[]> {
    const seen = new Set<string>();
    const result: RegistryModule[] = [];

    for (const reg of registries) {
        let entries: RegistryModule[] = [];

        if (reg.path) {
            entries = await fetchRegistryFromPath(reg.path);
        } else if (reg.raw) {
            entries = await fetchRegistryFromUrl(reg.raw);
        } else {
            console.warn(
                cleanMultiline(`${chalk.yellow("Registry entry has no valid source, skipping.")}
                ${chalk.green("Fix")}: Each registry entry must have either a "path" or "raw" field.`),
            );
            continue;
        }

        for (const mod of entries) {
            if (seen.has(mod.id)) {
                console.warn(`Found 2 exact modules with ID "${mod.id}" across registries. Ignoring.`);
                continue;
            }
            seen.add(mod.id);
            result.push(mod);
        }
    }

    return result;
}

export async function syncExternalModules(
    modules: RegistryModule[],
    registryModulesPath: string,
    lockPath: string,
): Promise<void> {
    const lockFile = await readFile(lockPath, "utf-8").catch(() => null);
    const lockModules: RegistryModule[] = lockFile ? JSON.parse(lockFile) : [];

    const toAdd = modules.filter((m) => !lockModules.find((l) => l.id === m.id));
    const toRemove = lockModules.filter((m) => !modules.find((e) => e.id === m.id));
    const toUpdate = modules.filter((m) => {
        const locked = lockModules.find((l) => l.id === m.id);
        return locked && locked.commit !== m.commit;
    });

    if (!toAdd.length && !toRemove.length && !toUpdate.length) {
        console.log(chalk.green("External modules are up to date."));
        return;
    }

    await mkdir(registryModulesPath, { recursive: true });

    const successfulAdds: RegistryModule[] = [];
    const failedAddIds = new Set<string>();
    const successfulUpdateIds = new Set<string>();
    const successfulRemoveIds = new Set<string>();

    for (const mod of toAdd) {
        const modPath = join(registryModulesPath, mod.id);
        try {
            await execFileAsync("git", ["clone", `${mod.repo}.git`, mod.id], {
                cwd: registryModulesPath,
            });
            await execFileAsync("git", ["checkout", mod.commit], { cwd: modPath });
            console.log(chalk.green(`Installed module ${mod.id} at ${mod.commit}.`));
            successfulAdds.push(mod);
        } catch (err) {
            console.error(
                cleanMultiline(`Failed to install module ${chalk.yellow(mod.id)}.
                ${chalk.gray(cleanMultiline(`Details:\n- Repo: ${mod.repo}\n- Commit: ${mod.commit}\n- Error: ${err}`))}`),
            );
            await rm(modPath, { recursive: true, force: true });
            failedAddIds.add(mod.id);
        }
    }

    for (const mod of toUpdate) {
        const modPath = join(registryModulesPath, mod.id);
        try {
            await execFileAsync("git", ["fetch"], { cwd: modPath });
            await execFileAsync("git", ["checkout", mod.commit], { cwd: modPath });
            console.log(chalk.green(`Updated module ${mod.id} to ${mod.commit}.`));
            successfulUpdateIds.add(mod.id);
        } catch (err) {
            console.error(
                cleanMultiline(`Failed to update module ${chalk.yellow(mod.id)}.
                ${chalk.gray(cleanMultiline(`Details:\n- Commit: ${mod.commit}\n- Error: ${err}`))}`),
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
                ${chalk.gray(`Details:\n- Error: ${err}`)}`),
            );
        }
    }

    const newLockState: RegistryModule[] = [
        ...lockModules.filter(
            (m) =>
                !successfulRemoveIds.has(m.id) &&
                !toUpdate.find((u) => u.id === m.id) &&
                !toAdd.find((a) => a.id === m.id),
        ),
        ...toUpdate
            .filter((m) => successfulUpdateIds.has(m.id))
            .map((m) => ({ ...m })),
        ...toUpdate
            .filter((m) => !successfulUpdateIds.has(m.id))
            .map((m) => lockModules.find((l) => l.id === m.id)!),
        ...successfulAdds,
    ];

    await writeFile(lockPath, JSON.stringify(newLockState), "utf-8");

    const anyFailed =
        failedAddIds.size > 0 ||
        toUpdate.some((m) => !successfulUpdateIds.has(m.id)) ||
        toRemove.some((m) => !successfulRemoveIds.has(m.id));

    if (anyFailed) {
        console.warn(chalk.yellow("Some module operations failed — lockfile reflects partial progress."));
    }
}

export async function getInstalledModuleDirs(registryModulesPath: string): Promise<string[] | null> {
    return readdir(registryModulesPath).catch(() => null);
}
