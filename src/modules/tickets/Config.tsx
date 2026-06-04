import type { ModuleConfigPageProps } from "../../web/types/modulePage";

export default function Config({
    guildId,
    moduleId,
    config,
    enabled,
    data,
    onUpdateConfig,
    onToggleEnabled,
}: ModuleConfigPageProps) {
    return (
        <div>
            <h1>Config</h1>
        </div>
    );
}
