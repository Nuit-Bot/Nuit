import type { ModuleConfigField } from "@nuit-bot/components";

type ConfigValue = string | number | boolean;

export type ModuleOverview = {
    id: string;
    name: string;
    kind: "internal" | "essential" | "optional" | null;
    enabled: boolean;
    configurable: boolean;
    hasPage: boolean;
    commandCount: number;
    eventCount: number;
    fieldCount: number;
    updatedAt: string | null;
};

export type ModuleConfigResponse = {
    guildId: string;
    module: string;
    schema: ModuleConfigField[];
    enabled: boolean;
    config: Record<string, ConfigValue>;
    updatedAt: string | null;
    hasPage: boolean;
};

type CurrentUser = {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
};

type MutualGuild = {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: string;
    features: string[];
};

type GuildResponse = {
    id: string;
    name: string;
    iconURL?: string | null;
    memberCount?: number;
    locale?: string;
};

class AuthError extends Error {
    constructor() {
        super("Not authenticated");
        this.name = "AuthError";
    }
}

function isJsonResponse(response: Response) {
    const contentType = response.headers.get("content-type");
    return typeof contentType === "string" && contentType.includes("application/json");
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
        credentials: "include",
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
        },
    });

    if (response.status === 401 || response.redirected || !isJsonResponse(response)) {
        throw new AuthError();
    }

    if (!response.ok) {
        throw new Error(`Request failed (${response.status}) for ${url}`);
    }

    return (await response.json()) as T;
}

export const api = {
    getCurrentUser() {
        return request<CurrentUser>("/api/users/@me");
    },
    getMutualGuilds() {
        return request<MutualGuild[]>("/api/guilds/common");
    },
    getGuild(guildId: string) {
        return request<GuildResponse>(`/api/guild/${guildId}`);
    },
    getGuildModules(guildId: string) {
        return request<ModuleOverview[]>(`/api/guild/${guildId}/modules`);
    },
    getModuleConfig(guildId: string, moduleId: string) {
        return request<ModuleConfigResponse>(
            `/api/guild/${guildId}/${encodeURIComponent(moduleId)}/config`,
        );
    },
    updateModuleConfig(
        guildId: string,
        moduleId: string,
        config: Record<string, ConfigValue>,
    ) {
        return request<ModuleConfigResponse>(
            `/api/guild/${guildId}/${encodeURIComponent(moduleId)}/config`,
            {
                method: "PUT",
                body: JSON.stringify({ config }),
            },
        );
    },
    toggleModuleEnabled(guildId: string, moduleId: string, enabled: boolean) {
        return request<{ enabled: boolean; updatedAt: string | null }>(
            `/api/guild/${guildId}/${encodeURIComponent(moduleId)}/enabled`,
            {
                method: "PUT",
                body: JSON.stringify({ enabled }),
            },
        );
    },
    async logout() {
        const response = await fetch("/api/auth/sign-out", {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`Logout failed (${response.status})`);
        }
    },
};

export { AuthError };
export type { CurrentUser, MutualGuild, GuildResponse };
