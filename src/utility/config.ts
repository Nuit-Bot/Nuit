import toml from "toml";
import fs from "fs/promises";

export interface ConfigRegistry {
    raw?: string;
    path?: string;
}
export interface Config {
    host: {
        hosters: string[];
        allow_command_reloading: boolean;
        allow_external_modules: boolean;
    };
    registries: ConfigRegistry[];
}

async function loadConfig(): Promise<Config> {
    let baseConfig = {};

    // Load base config if it exists
    try {
        const baseToml = await fs.readFile("./config.toml", "utf-8");
        baseConfig = toml.parse(baseToml);
    } catch (error) {
        // config.toml is optional, ignore if it doesn't exist
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error;
        }
    }

    // Load example config as fallback/default values
    let exampleConfig = {};
    try {
        const exampleToml = await fs.readFile("./config.example.toml", "utf-8");
        exampleConfig = toml.parse(exampleToml);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error;
        }
    }

    // Load private config (highest priority)
    let privateConfig = {};
    try {
        const privateToml = await fs.readFile("./config.private.toml", "utf-8");
        privateConfig = toml.parse(privateToml);
    } catch (error) {
        // config.private.toml is optional, ignore if it doesn't exist
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error;
        }
    }

    // Merge configurations with priority: private > base > example
    return deepMerge(deepMerge(exampleConfig, baseConfig), privateConfig);
}

/**
 * Keys whose arrays are concatenated across configs rather than replaced.
 * All other arrays (e.g. `hosters`) are replaced by the higher-priority config.
 */
const CONCAT_ARRAY_KEYS = new Set(["registries"]);

function deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
        if (source[key] === undefined) continue;

        const srcVal = source[key];
        const tgtVal = target[key];

        if (Array.isArray(srcVal)) {
            if (CONCAT_ARRAY_KEYS.has(key) && Array.isArray(tgtVal)) {
                result[key] = [...tgtVal, ...srcVal];
            } else {
                result[key] = srcVal;
            }
        } else if (
            typeof srcVal === "object" &&
            srcVal !== null &&
            typeof tgtVal === "object" &&
            tgtVal !== null
        ) {
            result[key] = deepMerge(tgtVal, srcVal);
        } else {
            result[key] = srcVal;
        }
    }

    return result;
}

export default await loadConfig();
