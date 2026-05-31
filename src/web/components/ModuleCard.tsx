import { GearIcon } from "@phosphor-icons/react";
import { Badge, Button, Card, Toggle } from "@nuit-bot/components";
import type { ModuleOverview } from "@nuit-bot/components";
import "./ModuleCard.css";

type ModuleCardProps = {
    module: ModuleOverview;
    onToggle: (moduleId: string, nextEnabled: boolean) => void;
    onConfigure?: (moduleId: string) => void;
    toggling?: boolean;
};

function formatDate(value: string | null) {
    if (!value) return "Never updated";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Unknown update time";

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(parsed);
}

export default function ModuleCard({
    module,
    onToggle,
    onConfigure,
    toggling = false,
}: ModuleCardProps) {
    return (
        <Card level={2} className="moduleCard">
            <div className="moduleCard__top">
                <div className="moduleCard__nameRow">
                    <h3>{module.name}</h3>
                    <Badge
                        label={module.enabled ? "Enabled" : "Disabled"}
                        variant={module.enabled ? "success" : "default"}
                    />
                </div>
                <p className="moduleCard__id">{module.id}</p>
            </div>

            <div className="moduleCard__facts">
                <span>{module.commandCount} commands</span>
                <span>{module.eventCount} events</span>
                <span>{module.fieldCount} fields</span>
                <span>{formatDate(module.updatedAt)}</span>
            </div>

            <div className="moduleCard__bottom">
                <Toggle
                    checked={module.enabled}
                    disabled={toggling}
                    label={module.enabled ? "Enabled" : "Disabled"}
                    onChange={(nextEnabled) => onToggle(module.id, nextEnabled)}
                />
                <Button
                    variant="ghost"
                    disabled={!module.configurable}
                    onClick={() => onConfigure?.(module.id)}
                >
                    <span className="moduleCard__buttonContent">
                        <GearIcon size={14} weight="bold" />
                        Configure
                    </span>
                </Button>
            </div>
        </Card>
    );
}
