import { useMemo, useState } from "react";
import { Button, ConfirmationDialog } from "@nuit-bot/components";
import { api, type CurrentUser } from "../lib/api";
import "./UserMenu.css";

type UserMenuProps = {
    user: CurrentUser;
};

export default function UserMenu({ user }: UserMenuProps) {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    const fallback = useMemo(() => {
        const source = user.displayName || user.username || "?";
        return source.slice(0, 1).toUpperCase();
    }, [user.displayName, user.username]);

    async function onConfirmLogout() {
        setLoggingOut(true);
        try {
            await api.logout();
            window.location.assign("/login");
        } finally {
            setLoggingOut(false);
            setConfirmOpen(false);
        }
    }

    return (
        <>
            <div className="userMenu">
                <div className="userMenu__identity">
                    {user.avatarUrl ? (
                        <img
                            src={user.avatarUrl}
                            alt={user.username}
                            className="userMenu__avatar"
                        />
                    ) : (
                        <div className="userMenu__fallbackAvatar">{fallback}</div>
                    )}
                    <span className="userMenu__name">{user.username}</span>
                </div>
                <Button
                    variant="ghost"
                    disabled={loggingOut}
                    onClick={() => setConfirmOpen(true)}
                >
                    Logout
                </Button>
            </div>

            <ConfirmationDialog
                open={confirmOpen}
                title="Log out now?"
                message="You will be signed out from the dashboard session."
                confirmText="Log out"
                onCancel={() => setConfirmOpen(false)}
                onConfirm={onConfirmLogout}
            />
        </>
    );
}
