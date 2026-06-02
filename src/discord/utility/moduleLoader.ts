import {
    createAPI,
    type BaseCtx,
    type Json,
    type ModuleContext,
    type ModuleRegistry,
    type NuitCommand,
} from "@nuit-bot/api";
import config from "../../utility/config";
import { getProjectRoot } from "../../utility/projectRoot";
import { client } from "../main";
import { readdir, readFile } from "node:fs/promises";
import { join } from "path";
import { Events, MessageFlags, REST, Routes } from "discord.js";
import { cleanMultiline } from "./cleanMultiline";
import chalk from "chalk";
import { TtlCache } from "../../utility/cache";
import { db } from "../../db/main";
import { guild_modules, guilds } from "../../db/schema";
import { and, eq } from "drizzle-orm";
import { createMessageBus } from "../../core/bus";

interface LockfileModule {
    version?: string;
    commit?: string;
}

interface LockfileData {
    modules: Record<string, LockfileModule>;
}

export const guildModulesCache = new TtlCache<
    string,
    {
        config: Json | null;
        enabled: boolean | null;
        guild_id: string;
        module_id: string;
        updated_at: Date | null;
    }[]
>(60_000);

export const guildAvailableCache = new TtlCache<string, boolean>(60_000);

export const globalRegistry: ModuleRegistry = {
    commands: [],
    events: [],
    config: [],
};

export const modulePages = new Set<string>();
export const modulePageSchemas = new Map<string, ModuleRegistry["config"]>();

export const bus = createMessageBus();

function hasCustomPage(packageJSON: Record<string, any>) {
    return typeof packageJSON.nuit?.page === "string";
}

export async function getPackageJSON(path: string) {
    const packageRaw = await readFile(path, "utf-8").catch(() => null);

    if (packageRaw === null) {
        return null;
    }

    try {
        return JSON.parse(packageRaw);
    } catch (err) {
        console.warn(
            chalk.yellow(
                cleanMultiline(
                    `Failed to parse the package.json file correctly:`,
                ),
            ),
            err,
        );
    }
}

export function applyConfigs(registry: ModuleRegistry, hasPage = false) {
    if (hasPage) return;

    registry.config.forEach((field) => {
        if (!field.key || !field.label || !field.type || !field.module) {
            return console.warn(
                cleanMultiline(
                    `Config field from ${field.module ?? "unknown module"} is missing required values.
                    ${chalk.green("Fix")}: Add the "key", "label", "type", and module-backed registration values.
                    ${chalk.gray(
                        cleanMultiline(`Details:
                                        - Key: ${field.key ?? "missing"}
                                        - Label: ${field.label ?? "missing"}
                                        - Type: ${field.type ?? "missing"}
                                        - Module name: ${field.module ?? "missing"}`),
                    )}`,
                ),
            );
        }

        globalRegistry.config.push(field);
    });
}

export function applyCommands(registry: ModuleRegistry) {
    registry.commands.forEach((command) => {
        if (!command.data || !command.execute) {
            return console.warn(
                cleanMultiline(
                    `Command ${command.module} is missing "data" and/or "execute" values.
                    ${chalk.green("Fix")}: Add the "data" and "execute" values.
                    ${chalk.gray(
                        cleanMultiline(`Details:
                                        - Module name: ${command.module}`),
                    )}`,
                ),
            );
        }

        globalRegistry.commands.push(command);
    });
}

export function applyEvents(registry: ModuleRegistry) {
    registry.events.forEach((event) => {
        if (!event.name || !event.handler) {
            return console.warn(
                cleanMultiline(
                    `Event ${String(event.name)} from ${event.module} is missing "name" and/or "handler" values.
                    ${chalk.green("Fix")}: Add the "name" and "handler" values.
                    ${chalk.gray(
                        cleanMultiline(`Details:
                                        - Module name: ${join(event.module)}`),
                    )}`,
                ),
            );
        }

        globalRegistry.events.push(event);
    });
}

export async function loadModule(
    path: string,
    moduleName: string,
    packageJSON: Record<string, any>,
) {
    try {
        const mod = await import(path);

        if (!mod || !mod.setup) {
            return console.warn(
                cleanMultiline(
                    `Skipping ${path} as its exports don't contain a setup() function.
                    ${chalk.green("Fix")}: Consider making the module export an object with a setup() function.
                    ${chalk.gray(
                        cleanMultiline(`Details:
                                        - Full path: ${join(path)}`),
                    )}`,
                ),
            );
        }

        const kind = packageJSON.nuit?.kind ?? null;
        const hasPage = hasCustomPage(packageJSON);

        const registry: ModuleRegistry = {
            commands: [],
            events: [],
            config: [],
        };

        const ctx: ModuleContext = {
            db,
            config,
            client,
            api: createAPI(registry, moduleName, kind),
            bus,
        };

        await mod.setup(ctx);

        if (hasPage) {
            modulePages.add(moduleName);
            modulePageSchemas.set(moduleName, registry.config);
        }

        applyConfigs(registry, hasPage);
        applyCommands(registry);
        applyEvents(registry);
    } catch (err) {
        console.error(`Error loading module ${path}`);
        console.error(err);
    }
}

const getGuildId = (...args: any[]) => {
    const first = args[0];
    if (!first) return null;

    return first.guildId ?? first.guild?.id ?? first.guild_id ?? null;
};

async function isGuildAvailable(guildId: string): Promise<boolean> {
    const cached = guildAvailableCache.get(guildId);
    if (cached !== undefined) return cached;

    const [data] = await db
        .select({ available: guilds.available })
        .from(guilds)
        .where(eq(guilds.guild_id, guildId))
        .limit(1);

    const available = data?.available === true;
    guildAvailableCache.set(guildId, available);
    return available;
}

export async function setupCommandsAndEvents() {
    globalRegistry.events.forEach((event) => {
        if (!event.name || !event.handler) {
            return;
        }

        async function handler(...args: any[]) {
            const guildId = getGuildId(...args);

            if (event.guildScoped) {
                if (!guildId) {
                    return console.warn(
                        `Event ${String(event.name)} from module ${event.module} is guild scoped but no guild ID was found.`,
                    );
                }

                // does mean that guilds added when bot was offline are rejected here
                if (!(await isGuildAvailable(guildId))) {
                    return console.warn("uhhh how is that happening?");
                }

                let modules = guildModulesCache.get(guildId);

                if (!modules) {
                    const rows = await db
                        .select({
                            guild_id: guild_modules.guild_id,
                            module_id: guild_modules.module_id,
                            enabled: guild_modules.enabled,
                            config: guild_modules.config,
                            updated_at: guild_modules.updated_at,
                        })
                        .from(guild_modules)
                        .where(eq(guild_modules.guild_id, String(guildId)));
                    modules = rows.map((row) => ({
                        ...row,
                        config: (row.config as Json | null) ?? null,
                    }));
                    guildModulesCache.set(guildId, modules);
                }

                const mod = modules.find((m) => m.module_id === event.module);
                if (!mod?.enabled) return console.warn("so it's disabled huh");
            }

            await (event.handler as (...a: any[]) => Promise<void> | void)(
                ...args,
            );
        }

        if (event.once) {
            client.once(event.name as string, handler);
        } else {
            client.on(event.name as string, handler);
        }
    });

    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const command = globalRegistry.commands.find(
            (com) => com.data.name === interaction.commandName,
        );

        if (!command) {
            console.error(`Could not find command ${interaction.commandName}`);
            console.error(`Interaction ID: ${interaction.id}`);

            return await interaction.reply({
                content: cleanMultiline(`# That isn't supposed to happen...
                    Seems like you ran a command that doesn't exist.
                    -# Do you have superpowers?!`),
                flags: MessageFlags.Ephemeral,
            });
        }

        const guildId = getGuildId(interaction);
        if (!guildId) {
            return await interaction.reply({
                content: cleanMultiline(`# This isn't the right place...
                You ran the command in a DM or a guild-less context.
                -# Run a command in a guild where I'm present!`),
            });
        }

        if (!(await isGuildAvailable(guildId)))
            return console.warn("uhhh how is that happening?");

        const [enabledModules] = await db
            .select({ enabled: guild_modules.enabled })
            .from(guild_modules)
            .where(
                and(
                    eq(guild_modules.guild_id, guildId),
                    eq(guild_modules.module_id, command.module),
                ),
            )
            .limit(1);

        if (!enabledModules?.enabled) {
            if (!command.kind || command.kind === "optional") {
                return await interaction.reply({
                    content: cleanMultiline(`# This module isn't enabled
                    The \`${command.module}\` module is disabled on this server.
                    -# Ask a server admin to enable it in the bot settings.`),
                    flags: MessageFlags.Ephemeral,
                });
            }
        }

        const baseCtx: BaseCtx = {
            client,
            db,
            config,
            bus,
        };

        try {
            await command.execute(interaction, baseCtx);
        } catch (err) {
            console.error(
                `Error executing command ${command.data.name} in guild ${interaction.guildId}`,
            );
            console.error(err);
            console.error(
                cleanMultiline(`Details:
                - Interaction ID: ${interaction.id}
                - Guild ID: ${interaction.guildId}
                - Command Name: ${command.data.name}
                - Module Name: ${command.module}`),
            );
        }
    });
}

export async function readLockfile() {
    try {
        const content = await readFile(
            join(getProjectRoot(), "nuit.lock"),
            { encoding: "utf-8" },
        );
        return JSON.parse(content) as LockfileData;
    } catch {
        return { modules: {} };
    }
}

export async function loadExternalModules() {
    const lockfile = await readLockfile();

    for (const [moduleName] of Object.entries(lockfile.modules)) {
        let pkgJSONPath: string;
        try {
            pkgJSONPath = Bun.resolveSync(
                moduleName + "/package.json",
                getProjectRoot(),
            );
        } catch {
            console.warn(
                chalk.yellow(
                    `Could not find module "${moduleName}" - is it installed?`,
                ),
            );
            continue;
        }

        const packageJSON = await getPackageJSON(pkgJSONPath);
        if (!packageJSON) {
            console.warn(
                chalk.yellow(
                    `Module "${moduleName}": package.json is missing or invalid.`,
                ),
            );
            continue;
        }

        if (!packageJSON.main) {
            console.warn(
                cleanMultiline(
                    `Module "${moduleName}" does not have a "main" entry in its package.json.
                    ${chalk.green("Fix")}: Consider adding it and point it to the module's main file.`,
                ),
            );
            continue;
        }

        const moduleDir = join(pkgJSONPath, "..");
        const entryPath = join(moduleDir, packageJSON.main);

        const entryExists = await Bun.file(entryPath).exists();
        if (!entryExists) {
            console.warn(
                cleanMultiline(
                    `${chalk.yellow(`Skipping "${moduleName}" as its entry file does not exist.`)}
                    ${chalk.green("Fix")}: Ensure the "main" field in package.json points to an existing file.
                    ${chalk.gray(
                        cleanMultiline(`Details:
                                        - Module: ${moduleName}
                                        - Entry path: ${entryPath}`),
                    )}`,
                ),
            );
            continue;
        }

        await loadModule(entryPath, packageJSON.name, packageJSON);
    }
}

export async function scanModules(path: string) {
    const modules = await readdir(path);

    for (const moduleDir of modules) {
        const packageJSON = await getPackageJSON(
            join(path, moduleDir, "package.json"),
        );

        if (!packageJSON) {
            console.warn(
                cleanMultiline(
                    `Skipping ${moduleDir} as it doesn't have a package.json.
                    ${chalk.green("Fix")}: Make one inside the module's root.
                    ${chalk.gray(
                        cleanMultiline(`Details:
                                        - Full path: ${join(path, moduleDir)}`),
                    )}`,
                ),
            );
            continue;
        }

        if (!packageJSON.name) {
            console.warn(
                cleanMultiline(
                    `Skipping ${moduleDir} as its package.json does not have a "name" entry.
                    ${chalk.green("Fix")}: Consider adding it with a unique name (for example, a scoped module like @nuit-bot/module-welcome).
                    ${chalk.gray(
                        cleanMultiline(`Details:
                                        - Full path: ${join(path, moduleDir)}`),
                    )}`,
                ),
            );
            continue;
        }

        if (!packageJSON.main) {
            console.warn(
                cleanMultiline(
                    `Skipping ${moduleDir} as its package.json does not have a "main" entry.
                    ${chalk.green("Fix")}: Consider adding it and point it to the module's main file.
                    ${chalk.gray(
                        cleanMultiline(`Details:
                                        - Full path: ${join(path, moduleDir)}`),
                    )}`,
                ),
            );
            continue;
        }

        const entryPath = join(path, moduleDir, packageJSON.main);

        const entryExists = await Bun.file(entryPath).exists();
        if (!entryExists) {
            console.warn(
                cleanMultiline(
                    `${chalk.yellow(`Skipping ${moduleDir} as its entry file does not exist.`)}
                    ${chalk.green("Fix")}: Ensure the "main" field in package.json points to an existing file.
                    ${chalk.gray(
                        cleanMultiline(`Details:
                                        - Entry path: ${entryPath}`),
                    )}`,
                ),
            );
            continue;
        }

        await loadModule(entryPath, packageJSON.name, packageJSON);
    }
}

export async function pushCommandsToDiscord(commands: NuitCommand[]) {
    const rest = new REST().setToken(process.env.DISCORD_TOKEN as string);

    const mappedCommands = commands.map((c) =>
        typeof c.data.toJSON === "function" ? c.data.toJSON() : c.data,
    );

    try {
        await rest.put(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID as string),
            { body: mappedCommands },
        );
    } catch (err) {
        console.error(
            cleanMultiline(`Failed to push commands to Discord.
        ${chalk.gray(
            cleanMultiline(`Details:
            - Command count: ${mappedCommands.length}
            - Commands: ${mappedCommands.map((c: any) => c.name).join(", ")}
            - Error: ${err}`),
        )}`),
        );
    }
}
