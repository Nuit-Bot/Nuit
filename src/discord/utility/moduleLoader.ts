import {
    createAPI,
    type BaseCtx,
    type ModuleContext,
    type ModuleRegistry,
} from "@nuit-bot/api";
import config from "../../utility/config";
import { getSupabaseClient } from "../../utility/supabase";
import { client } from "../main";
import fs from "fs";
import { join } from "path";
import { Events, MessageFlags } from "discord.js";
import { cleanMultiline } from "./cleanMultiline";
import chalk from "chalk";

const supabase = getSupabaseClient();

export const globalRegistry: ModuleRegistry = {
    commands: [],
    events: [],
};

export async function applyCommands(registry: ModuleRegistry) {
    registry.commands.forEach((command) => {
        if (!command.data || !command.execute) {
            return console.warn(
                cleanMultiline(
                    `Command ${command.module} is missing "data" and/or "execute" values.
                    ${chalk.green("Fix")}: Add the "data" and "execute" values.
                    ${chalk.gray(
                        cleanMultiline(`Details:
                                        - Module name: ${join(command.module)}`),
                    )}`,
                ),
            );
        }

        globalRegistry.commands.push(command);
    });
}

export async function applyEvents(registry: ModuleRegistry) {
    registry.events.forEach((event) => {
        if (!event.name || !event.handler) {
            return console.warn(
                cleanMultiline(
                    `Event ${event} is missing "name" and/or "handler" values.
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

export async function loadModule(path: string, moduleName: string) {
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

        const registry: ModuleRegistry = {
            commands: [],
            events: [],
        };

        const ctx: ModuleContext = {
            supabase,
            config,
            client,
            api: createAPI(registry, moduleName),
        };

        await mod.setup(ctx);

        await applyCommands(registry);
        await applyEvents(registry);
    } catch (err) {
        console.error(`Error loading module ${path}`);
        console.error(err);
    }
}

const getGuildId = async (...args: any[]) => args[0]?.guildId ?? null; // Get guild ID from interactions, messages, etc.

export async function setupCommandsAndEvents() {
    globalRegistry.events.forEach((event) => {
        if (!event.name || !event.handler) {
            return;
        }

        async function handler(...args: any[]) {
            const guildId = getGuildId(...args);
            if (!guildId) return; // Probably a DM or guild-less context

            const { data: enabledModules } = await supabase
                .from("guild_modules")
                .select("*")
                .eq("guild_id", String(guildId))
                .eq("module_id", event.module)
                .single();

            if (!enabledModules?.enabled) {
                return;
            }

            await event.handler(...args);
        }

        if (event.once) {
            client.once(event.name, handler);
        } else {
            client.on(event.name, handler);
        }
    });

    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isCommand()) return;

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
        if (!guildId) return; // Probably a DM or guild-less context

        const { data: enabledModules } = await supabase
            .from("guild_modules")
            .select("*")
            .eq("guild_id", String(guildId))
            .eq("module_id", command.module)
            .single();

        if (!enabledModules?.enabled) {
            return;
        }

        const baseCtx: BaseCtx = {
            client,
            supabase,
            config,
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

export async function scanModules(path: string) {
    const modules = await fs.readdirSync(path);

    for (const moduleDir of modules) {
        const packagePath = join(path, moduleDir, "package.json");

        if (!fs.existsSync(packagePath)) {
            console.warn(
                cleanMultiline(
                    `${chalk.yellow(`Skipping ${moduleDir} as it does not have a package.json file.`)}
                    ${chalk.green("Fix")}: Create the package.json file in the module root.
                    ${chalk.gray(
                        cleanMultiline(`Details:
                                        - Full path: ${join(path, moduleDir)}`),
                    )}`,
                ),
            );

            continue;
        }

        const packageJSON = JSON.parse(
            fs.readFileSync(packagePath, { encoding: "utf-8" }),
        );

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

        if (!fs.existsSync(entryPath)) {
            return;
        }

        await loadModule(entryPath, packageJSON.name);
    }
}
