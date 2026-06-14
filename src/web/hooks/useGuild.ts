import { useEffect, useState } from "react";
import { AuthError, api, type GuildResponse, type ModuleOverview } from "../lib/api";

type UseGuildState = {
    guild: GuildResponse | null;
    modules: ModuleOverview[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
};

export default function useGuild(guildId: string): UseGuildState {
    const [guild, setGuild] = useState<GuildResponse | null>(null);
    const [modules, setModules] = useState<ModuleOverview[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    async function load() {
        if (!guildId) {
            setGuild(null);
            setModules([]);
            setLoading(false);
            setError("Missing guild ID");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const [nextGuild, nextModules] = await Promise.all([
                api.getGuild(guildId),
                api.getGuildModules(guildId),
            ]);

            setGuild(nextGuild);
            setModules(nextModules);
        } catch (err: unknown) {
            if (err instanceof AuthError) {
                window.location.assign("/login");
                return;
            }
            setError(err instanceof Error ? err.message : "Failed to load guild");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, [guildId]);

    return {
        guild,
        modules,
        loading,
        error,
        refetch: load,
    };
}
