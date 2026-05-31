import { Navigate } from "react-router-dom";
import { Button, Card, Container } from "@nuit-bot/components";
import useAuth from "../hooks/useAuth";
import useDocumentTitle from "../hooks/useDocumentTitle";
import "./Login.css";

export default function Login() {
    useDocumentTitle("Login - Nuit");

    const { user, loading } = useAuth();

    if (loading) {
        return (
            <Container size="sm">
                <main className="loginPage">
                    <Card level={2}>
                        <p>Checking your session...</p>
                    </Card>
                </main>
            </Container>
        );
    }

    if (user) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <Container size="sm">
            <main className="loginPage">
                <Card level={2} className="loginCard">
                    <p className="loginCard__eyebrow">Nuit Dashboard</p>
                    <h1>Login with Discord</h1>
                    <p className="loginCard__text">
                        Sign in to manage your guild modules and per-server
                        configuration.
                    </p>
                    <a href="/api/auth/discord/login" className="loginCard__action">
                        <Button variant="primary">Continue with Discord</Button>
                    </a>
                </Card>
            </main>
        </Container>
    );
}
