import { useState } from "react";
import {
    Badge, Button, Card, Checkbox, ConfigPanel,
    ConfirmationDialog, Container, Divider,
    FieldError, FieldLevelFeedback, FormField, FormGroup,
    Input, Select, Stack, Textarea, Toggle, UnsavedChangesIndicator,
} from "@nuit-bot/components";
import type { ModuleConfigField, ModuleOverview } from "@nuit-bot/components";
import ModuleList from "../components/ModuleList";
import ServerIcon from "../components/ServerIcon";
import useDocumentTitle from "../hooks/useDocumentTitle";
import "../styles/global.css";
import "./Test.css";
import {
    WarningIcon,
    CheckCircleIcon,
    XIcon,
    InfoIcon,
    LockIcon,
} from "@phosphor-icons/react";

export default function StyleTest() {
    useDocumentTitle("Style test - Nuit");

    const [inputValue, setInputValue] = useState("hello");
    const [selectValue, setSelectValue] = useState("optional");
    const [textareaValue, setTextareaValue] = useState("Welcome {{displayName}}!");
    const [toggleValue, setToggleValue] = useState(true);
    const [checkboxValue, setCheckboxValue] = useState(false);
    const [showDialog, setShowDialog] = useState(false);

    const [configValues, setConfigValues] = useState<
        Record<string, string | number | boolean>
    >({
        welcomeChannelId: "1234567890",
        welcomeMessage: "Welcome {{displayName}}!",
        logPublicEvents: true,
        maxWarnings: 3,
        level: "optional",
    });

    const moduleFields: ModuleConfigField[] = [
        {
            type: "channel",
            key: "welcomeChannelId",
            label: "Welcome Channel ID",
            description: "Channel used for welcoming new users",
            optional: false,
            group: "General",
        },
        {
            type: "string",
            key: "welcomeMessage",
            label: "Welcome Message",
            description: "Supports {{displayName}} variable",
            optional: true,
            max: 220,
            group: "General",
        },
        {
            type: "boolean",
            key: "logPublicEvents",
            label: "Log Public Events",
            description: "Send public moderation logs to channel",
            optional: true,
            group: "Behavior",
        },
        {
            type: "number",
            key: "maxWarnings",
            label: "Max Warnings",
            description: "Number of warnings before an action triggers",
            min: 1,
            max: 10,
            optional: false,
            group: "Behavior",
        },
        {
            type: "select",
            key: "level",
            label: "Module Level",
            optional: false,
            options: [
                { label: "Essential", value: "essential" },
                { label: "Optional", value: "optional" },
            ],
            group: "Behavior",
        },
    ];

    const modules: ModuleOverview[] = [
        {
            id: "@nuit-bot/module-arrival",
            name: "Arrival",
            kind: "optional",
            enabled: true,
            configurable: true,
            commandCount: 0,
            eventCount: 2,
            fieldCount: 4,
            updatedAt: new Date().toISOString(),
        },
        {
            id: "@nuit-bot/module-logger",
            name: "Logger",
            kind: "optional",
            enabled: false,
            configurable: true,
            commandCount: 0,
            eventCount: 1,
            fieldCount: 1,
            updatedAt: null,
        },
    ];

    return (
        <Container size="lg">
            <div className="testPage">
            <h2>Buttons</h2>
            <Button variant="primary">Primary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="primary" loading={true}>
                Loading
            </Button>
            <Button variant="primary" disabled={true}>
                Disabled
            </Button>
            <h2>Server Icon</h2>
            <ServerIcon
                iconUrl="https://images.unsplash.com/photo-1779332317860-ddf6f5ee74a2?w=48&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHwzfHx8ZW58MHx8fHx8"
                name="Hello"
            ></ServerIcon>
            <ServerIcon iconUrl="" name="Hello"></ServerIcon>
            <h2>Cards</h2>
            <div
                style={{
                    width: "400px",
                    height: "100px",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <Card level={1} className="card--row">
                    <ServerIcon
                        name="Hello"
                        iconUrl="https://images.unsplash.com/photo-1779332317860-ddf6f5ee74a2?w=48&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHwzfHx8ZW58MHx8fHx8"
                    ></ServerIcon>

                    <h1>Hello</h1>
                </Card>
            </div>
            <h2>Badges</h2>
            <Badge
                label="Not installed"
                variant="warning"
                icon={<WarningIcon size={12} weight="fill" />}
            />
            <Badge
                label="Bot installed"
                variant="success"
                icon={<CheckCircleIcon size={12} weight="fill" />}
            />
            <Badge
                label="Banned"
                variant="danger"
                icon={<XIcon size={12} weight="bold" />}
            />
            <Badge
                label="Beta"
                variant="info"
                icon={<InfoIcon size={12} weight="fill" />}
            />
            <Badge
                label="Private"
                variant="default"
                icon={<LockIcon size={12} weight="fill" />}
            />
            <Badge label="Unlisted" variant="default" />

            <h2>Inputs</h2>
            <Input value={inputValue} onChange={setInputValue} placeholder="Text input" />
            <Input type="search" value={inputValue} onChange={setInputValue} placeholder="Search input" />
            <Input type="password" value={inputValue} onChange={setInputValue} placeholder="Password input" />
            <Input type="number" value={3} onChange={() => {}} min={1} max={10} />

            <h2>Select / Textarea / Toggle / Checkbox</h2>
            <Select
                value={selectValue}
                onChange={setSelectValue}
                options={[
                    { label: "Essential", value: "essential" },
                    { label: "Optional", value: "optional" },
                ]}
            />
            <Textarea value={textareaValue} onChange={setTextareaValue} />
            <Toggle checked={toggleValue} onChange={setToggleValue} label="Toggle enabled" />
            <Checkbox checked={checkboxValue} onChange={setCheckboxValue} label="Checkbox enabled" />

            <h2>Form / Feedback</h2>
            <FormField label="Example Field" helpText="This is helper text" optional>
                <Input value={inputValue} onChange={setInputValue} />
            </FormField>
            <FormGroup title="General Settings" description="Grouped fields in two-column layout">
                <FormField label="First" required>
                    <Input value={inputValue} onChange={setInputValue} />
                </FormField>
                <FormField label="Second">
                    <Input value={inputValue} onChange={setInputValue} />
                </FormField>
            </FormGroup>
            <FieldError message="This field is required." />
            <FieldLevelFeedback type="conflict" message="This value conflicts with logger module." />
            <FieldLevelFeedback type="warning" message="This value might be too broad." />
            <FieldLevelFeedback type="info" message="This value is used as fallback." />

            <h2>Layout Helpers</h2>
            <Stack direction="row" gap="sm" wrap>
                <Card level={1}>A</Card>
                <Card level={2}>B</Card>
                <Card level={3}>C</Card>
            </Stack>
            <Divider />

            <h2>Module List</h2>
            <ModuleList
                modules={modules}
                onToggleModule={() => {}}
                onConfigureModule={() => {}}
            />

            <h2>Config Panel</h2>
            <ConfigPanel
                fields={moduleFields}
                values={configValues}
                validationErrors={{}}
                fieldFeedback={{ welcomeChannelId: "Use a text channel ID." }}
                onChange={(key, value) => {
                    setConfigValues((previous) => ({
                        ...previous,
                        [key]: value,
                    }));
                }}
                onSave={() => {}}
            />

            <h2>Dialog / Unsaved</h2>
            <Button variant="danger" onClick={() => setShowDialog(true)}>
                Open confirmation dialog
            </Button>
            <ConfirmationDialog
                open={showDialog}
                title="Disable essential module?"
                message="This may break dependent features for your guild."
                confirmText="Disable"
                danger
                onCancel={() => setShowDialog(false)}
                onConfirm={() => setShowDialog(false)}
            />
            <UnsavedChangesIndicator
                visible
                onSave={() => {}}
                onDiscard={() => {}}
            />
            </div>
        </Container>
    );
}
