import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Card, Container } from "@nuit-bot/components";
import ModuleList from "../components/ModuleList";
import UserMenu from "../components/UserMenu";
import useAuth from "../hooks/useAuth";
import useDocumentTitle from "../hooks/useDocumentTitle";
import useGuild from "../hooks/useGuild";
import { api } from "../lib/api";
import "./GuildSettings.css";

export default function GuildSettings() {
    const { id } = useParams();
    const guildId = id ?? "";
    const navigate = useNavigate();

    const { user, loading: authLoading } = useAuth();
    const { guild, modules, loading, error, refetch } = useGuild(guildId);

    useDocumentTitle(
        guild?.name ? `${guild.name} - Nuit` : "Guild overview - Nuit",
    );

    const [togglingModuleId, setTogglingModuleId] = useState<string | undefined>(
        undefined,
    );

    const enabledCount = useMemo(
        () => modules.filter((module) => module.enabled).length,
        [modules],
    );
    const configurableCount = useMemo(
        () => modules.filter((module) => module.configurable).length,
        [modules],
    );

    async function onToggleModule(moduleId: string, nextEnabled: boolean) {
        try {
            setTogglingModuleId(moduleId);
            await api.toggleModuleEnabled(guildId, moduleId, nextEnabled);
            await refetch();
        } finally {
            setTogglingModuleId(undefined);
        }
    }

    if (!authLoading && !user) {
        return <Navigate to="/login" replace />;
    }

    if (!guildId) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <main className="guildSettingsPage">
            <Container size="lg">
                {user ? (
                    <div className="guildSettingsTopbar">
                        <UserMenu user={user} />
                    </div>
                ) : null}
                <section className="guildSettingsHeader">
                    <Link to="/dashboard" className="guildSettingsBack">
                        Back to dashboard
                    </Link>
                    <p className="guildSettingsEyebrow">Guild overview</p>
                    <h1>{guild?.name ?? "Loading guild..."}</h1>
                    <p className="guildSettingsMeta">
                        {guild?.memberCount ?? 0} members
                    </p>
                </section>

                <section className="guildSettingsStats">
                    <Card level={2}>
                        <p>Members</p>
                        <strong>{guild?.memberCount ?? 0}</strong>
                    </Card>
                    <Card level={2}>
                        <p>Modules</p>
                        <strong>{modules.length}</strong>
                    </Card>
                    <Card level={2}>
                        <p>Enabled</p>
                        <strong>{enabledCount}</strong>
                    </Card>
                    <Card level={2}>
                        <p>Configurable</p>
                        <strong>{configurableCount}</strong>
                    </Card>
                </section>

                <section className="guildSettingsModuleArea">
                    <div className="guildSettingsModuleTitle">
                        <h2>Modules</h2>
                        <p>Manage installed modules for this guild.</p>
                    </div>
                    {loading ? <p>Loading modules...</p> : null}
                    {error ? <p className="guildSettingsError">{error}</p> : null}
                    <ModuleList
                        modules={modules}
                        togglingModuleId={togglingModuleId}
                        onToggleModule={onToggleModule}
                        onConfigureModule={(moduleId) => {
                            navigate(
                                `/dashboard/${guildId}/${encodeURIComponent(moduleId)}`,
                            );
                        }}
                    />
                </section>
            </Container>
        </main>
    );
}
