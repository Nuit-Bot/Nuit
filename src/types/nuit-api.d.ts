import type { Json } from "@nuit-bot/api";

declare module "@nuit-bot/api" {
    interface NuitAPI {
        getGuildConfig<T = Json>(guildId: string): Promise<T | null>;
        setGuildConfig<T = Json>(guildId: string, config: T): Promise<void>;
        updateGuildConfig<T = Json>(
            guildId: string,
            patch: Partial<T>,
        ): Promise<T>;
        isEnabled(guildId: string): Promise<boolean>;
        tableName(name: string): string;
    }
}
