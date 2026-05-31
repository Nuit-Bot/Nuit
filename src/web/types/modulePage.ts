import type { ModuleConfigField } from "@nuit-bot/components";

export type ConfigValue = string | number | boolean;

export interface ModuleConfigPageProps {
    guildId: string;
    moduleId: string;
    config: Record<string, ConfigValue>;
    enabled: boolean;
    data: {
        schema: ModuleConfigField[];
        updatedAt: string | null;
    };
    onUpdateConfig: (config: Record<string, ConfigValue>) => Promise<void>;
    onToggleEnabled: (enabled: boolean) => Promise<void>;
}
