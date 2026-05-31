import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
    Button, Card, ConfigPanel, ConfirmationDialog,
    Container, UnsavedChangesIndicator,
} from "@nuit-bot/components";
import { useModuleConfig } from "@nuit-bot/components";
import type { ModuleConfigResponse, ModuleOverview } from "../lib/api";
import type { ConfigValue } from "../types/modulePage";
import UserMenu from "../components/UserMenu";
import useAuth from "../hooks/useAuth";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { AuthError, api } from "../lib/api";
import { modulePages } from "./modules/manifest";
import "./ModuleConfig.css";

function formatDate(value: string | null) {
    if (!value) return "Never";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown";

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

export default function ModuleConfig() {
    const { guildId, moduleId } = useParams();
    const resolvedGuildId = guildId ?? "";
    const resolvedModuleId = moduleId ?? "";

    const { user, loading: authLoading } = useAuth();

    const [data, setData] = useState<ModuleConfigResponse | null>(null);
    const [moduleMeta, setModuleMeta] = useState<ModuleOverview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [togglingEnabled, setTogglingEnabled] = useState(false);
    const [showDisableDialog, setShowDisableDialog] = useState(false);

    useDocumentTitle(
        moduleMeta?.name
            ? `${moduleMeta.name} config - Nuit`
            : "Module config - Nuit",
    );

    const configState = useModuleConfig({
        initialConfig: data?.config ?? {},
        schema: data?.schema ?? [],
    });

    const pageLoader = data?.hasPage ? modulePages[resolvedModuleId] : undefined;
    const CustomPageComponent = useMemo(() => {
        return pageLoader ? lazy(pageLoader) : null;
    }, [pageLoader]);

    useEffect(() => {
        if (!resolvedGuildId || !resolvedModuleId) return;

        let active = true;
        setLoading(true);
        setError(null);

        Promise.all([
            api.getModuleConfig(resolvedGuildId, resolvedModuleId),
            api.getGuildModules(resolvedGuildId),
        ])
            .then(([moduleConfig, allModules]) => {
                if (!active) return;
                setData(moduleConfig);
                setModuleMeta(
                    allModules.find((module) => module.id === resolvedModuleId) ??
                        null,
                );
            })
            .catch((err: unknown) => {
                if (!active) return;
                if (err instanceof AuthError) {
                    window.location.assign("/login");
                    return;
                }
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to load module config",
                );
            })
            .finally(() => {
                if (!active) return;
                setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [resolvedGuildId, resolvedModuleId]);

    const fieldFeedback = useMemo(() => {
        const feedback: Record<string, string> = {};
        for (const field of data?.schema ?? []) {
            if (field.type === "channel") {
                feedback[field.key] =
                    "Use a Discord channel snowflake ID (17-20 digits).";
            }
            if (field.type === "role") {
                feedback[field.key] =
                    "Use a Discord role snowflake ID (17-20 digits).";
            }
            if (field.type === "user") {
                feedback[field.key] =
                    "Use a Discord user snowflake ID (17-20 digits).";
            }
        }
        return feedback;
    }, [data?.schema]);

    const handlePageUpdateConfig = useCallback(
        async (newConfig: Record<string, ConfigValue>) => {
            if (!data) return;

            setSaving(true);
            try {
                const response = await api.updateModuleConfig(
                    resolvedGuildId,
                    resolvedModuleId,
                    newConfig,
                );
                setData(response);
            } catch (err: unknown) {
                if (err instanceof AuthError) {
                    window.location.assign("/login");
                    return;
                }
                setError(
                    err instanceof Error ? err.message : "Failed to save module config",
                );
            } finally {
                setSaving(false);
            }
        },
        [data, resolvedGuildId, resolvedModuleId],
    );

    async function onSave() {
        if (!data) return;
        if (!configState.validate()) return;

        setSaving(true);
        try {
            const response = await api.updateModuleConfig(
                resolvedGuildId,
                data.module,
                configState.toPayload(),
            );
            setData(response);
        } catch (err: unknown) {
            if (err instanceof AuthError) {
                window.location.assign("/login");
                return;
            }
            setError(
                err instanceof Error ? err.message : "Failed to save module config",
            );
        } finally {
            setSaving(false);
        }
    }

    async function onToggleEnabled(nextEnabled: boolean) {
        if (!data) return;

        if (
            moduleMeta?.kind === "essential" &&
            data.enabled &&
            !nextEnabled
        ) {
            setShowDisableDialog(true);
            return;
        }

        setTogglingEnabled(true);
        try {
            const result = await api.toggleModuleEnabled(
                resolvedGuildId,
                data.module,
                nextEnabled,
            );
            setData({
                ...data,
                enabled: result.enabled,
                updatedAt: result.updatedAt,
            });
        } catch (err: unknown) {
            if (err instanceof AuthError) {
                window.location.assign("/login");
                return;
            }
            setError(
                err instanceof Error ? err.message : "Failed to update module status",
            );
        } finally {
            setTogglingEnabled(false);
        }
    }

    async function confirmDisableEssential() {
        if (!data) return;
        setTogglingEnabled(true);
        try {
            const result = await api.toggleModuleEnabled(
                resolvedGuildId,
                data.module,
                false,
            );
            setData({
                ...data,
                enabled: result.enabled,
                updatedAt: result.updatedAt,
            });
            setShowDisableDialog(false);
        } catch (err: unknown) {
            if (err instanceof AuthError) {
                window.location.assign("/login");
                return;
            }
            setError(
                err instanceof Error ? err.message : "Failed to update module status",
            );
        } finally {
            setTogglingEnabled(false);
        }
    }

    if (!authLoading && !user) {
        return <Navigate to="/login" replace />;
    }

    if (!resolvedGuildId || !resolvedModuleId) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <main className="moduleConfigPage">
            <Container size="lg">
                {user ? (
                    <div className="moduleConfigTopbar">
                        <UserMenu user={user} />
                    </div>
                ) : null}
                <section className="moduleConfigHeader">
                    <Link
                        className="moduleConfigBack"
                        to={`/dashboard/${resolvedGuildId}/overview`}
                    >
                        Back to overview
                    </Link>
                    <p className="moduleConfigEyebrow">Module configuration</p>
                    <h1>{moduleMeta?.name ?? resolvedModuleId}</h1>
                    <p className="moduleConfigSubtitle">
                        {CustomPageComponent
                            ? "Custom configuration page provided by this module."
                            : "Edit this module's guild-specific settings."}
                    </p>
                </section>

                {loading ? <p>Loading module configuration...</p> : null}
                {error ? <p className="moduleConfigError">{error}</p> : null}

                {data ? (
                    <>
                        <section className="moduleConfigSummary">
                            <Card level={2}>
                                <p>Module</p>
                                <strong>{data.module}</strong>
                            </Card>
                            <Card level={2}>
                                <p>Status</p>
                                <strong>{data.enabled ? "Enabled" : "Disabled"}</strong>
                            </Card>
                            <Card level={2}>
                                <p>Last update</p>
                                <strong>{formatDate(data.updatedAt)}</strong>
                            </Card>
                            <Card level={2} className="moduleConfigStatusToggle">
                                <Button
                                    variant={data.enabled ? "danger" : "primary"}
                                    loading={togglingEnabled}
                                    onClick={() => onToggleEnabled(!data.enabled)}
                                >
                                    {data.enabled ? "Disable" : "Enable"}
                                </Button>
                            </Card>
                        </section>

                        {data.hasPage && !modulePages[resolvedModuleId] ? (
                            <p className="moduleConfigError">
                                This module provides a custom configuration page, but it
                                has not been built yet. Run <code>bun run build:web</code>{" "}
                                to include it.
                            </p>
                        ) : null}

                        {CustomPageComponent ? (
                            <Suspense
                                fallback={
                                    <div className="moduleConfigLoading">
                                        Loading custom configuration...
                                    </div>
                                }
                            >
                                <CustomPageComponent
                                    guildId={resolvedGuildId}
                                    moduleId={resolvedModuleId}
                                    config={data.config}
                                    enabled={data.enabled}
                                    data={{
                                        schema: data.schema,
                                        updatedAt: data.updatedAt,
                                    }}
                                    onUpdateConfig={handlePageUpdateConfig}
                                    onToggleEnabled={onToggleEnabled}
                                />
                            </Suspense>
                        ) : data.schema.length > 0 ? (
                            <>
                                <section>
                                    <ConfigPanel
                                        fields={data.schema}
                                        values={configState.values}
                                        validationErrors={configState.validationErrors}
                                        fieldFeedback={fieldFeedback}
                                        saving={saving}
                                        onChange={configState.onChange}
                                        onSave={onSave}
                                    />
                                </section>

                                <UnsavedChangesIndicator
                                    visible={configState.hasUnsavedChanges}
                                    saving={saving}
                                    onDiscard={configState.reset}
                                    onSave={onSave}
                                />
                            </>
                        ) : null}

                        <ConfirmationDialog
                            open={showDisableDialog}
                            title="Disable essential module?"
                            message="This module is marked essential and disabling it may impact dependent features."
                            confirmText="Disable"
                            danger
                            onCancel={() => setShowDisableDialog(false)}
                            onConfirm={confirmDisableEssential}
                        />
                    </>
                ) : null}
            </Container>
        </main>
    );
}
