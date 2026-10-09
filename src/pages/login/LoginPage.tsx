import React, { useState, type FormEvent } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { loginThunk } from "../../store";
import type { AppDispatch } from "../../store";
import { useLoading } from "../../components/loading";
import "./styles.css";

function LoginPage() {
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const loadingCtx = useLoading();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        loadingCtx?.setLoading(true);

        const result = await dispatch(loginThunk({ email, password }));

        loadingCtx?.setLoading(false);

        if (loginThunk.fulfilled.match(result)) {
            navigate("/");
        } else {
            setError(result.payload ?? "Failed to log in");
        }
    };

    return (
        <div className="login-page-container">
            <h1>Login</h1>
            <p className="login-hint">Demo credentials: demo@example.com / password123</p>
            <form onSubmit={handleSubmit}>
                <div className="login-field">
                    <label htmlFor="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        autoComplete="username"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                    />
                </div>
                <div className="login-field">
                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                    />
                </div>
                {error && (
                    <p className="login-error" role="alert">
                        {error}
                    </p>
                )}
                <button type="submit">Log in</button>
            </form>
        </div>
    );
}

export default LoginPage;
