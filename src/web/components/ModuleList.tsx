import type { ModuleOverview } from "../lib/api";
import ModuleCard from "./ModuleCard";
import "./ModuleList.css";

type ModuleListProps = {
    modules: ModuleOverview[];
    togglingModuleId?: string;
    onToggleModule: (moduleId: string, nextEnabled: boolean) => void;
    onConfigureModule?: (moduleId: string) => void;
};

export default function ModuleList({
    modules,
    togglingModuleId,
    onToggleModule,
    onConfigureModule,
}: ModuleListProps) {
    if (modules.length === 0) {
        return (
            <div className="moduleList__empty">
                No modules are currently registered for this guild.
            </div>
        );
    }

    return (
        <div className="moduleList">
            {modules.map((module) => (
                <ModuleCard
                    key={module.id}
                    module={module}
                    toggling={togglingModuleId === module.id}
                    onToggle={onToggleModule}
                    onConfigure={onConfigureModule}
                />
            ))}
        </div>
    );
}
