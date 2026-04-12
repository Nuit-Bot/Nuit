import toml from "toml";
import fs from "fs/promises";

async function loadConfig(): Promise<any> {
    let baseConfig = {};

    // Load base config if it exists
    try {
        const baseToml = await fs.readFile('./config.toml', 'utf-8');
        baseConfig = toml.parse(baseToml);
    } catch (error) {
        // config.toml is optional, ignore if it doesn't exist
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
        }
    }

    // Load example config as fallback/default values
    let exampleConfig = {};
    try {
        const exampleToml = await fs.readFile('./config.example.toml', 'utf-8');
        exampleConfig = toml.parse(exampleToml);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
        }
    }

    // Load private config (highest priority)
    let privateConfig = {};
    try {
        const privateToml = await fs.readFile('./config.private.toml', 'utf-8');
        privateConfig = toml.parse(privateToml);
    } catch (error) {
        // config.private.toml is optional, ignore if it doesn't exist
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
        }
    }

    // Merge configurations with priority: private > base > example
    return deepMerge(deepMerge(exampleConfig, baseConfig), privateConfig);
}

function deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
        if (source[key] !== undefined) {
            if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key]) && typeof target[key] === 'object' && target[key] !== null) {
                result[key] = deepMerge(target[key], source[key]);
            } else {
                result[key] = source[key];
            }
        }
    }

    return result;
}

export default await loadConfig();