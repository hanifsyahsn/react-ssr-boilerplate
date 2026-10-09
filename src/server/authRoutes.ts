import { Router } from "express";
import { DUMMY_CREDENTIALS, clearSession, getUserFromAccessToken, issueSession } from "./mockAuth";
import type { JsonApiDataResponse, JsonApiErrorResponse, UserAttributes } from "../types/auth";

// Simulated network latency so the dummy endpoints feel like a real API call
// (login "loading" states etc.) instead of resolving instantly.
const MOCK_LATENCY_MS = 400;
const delay = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));

function unauthorized(detail: string): JsonApiErrorResponse {
    return { errors: [{ status: "401", title: "Unauthorized", detail }] };
}

export const authRouter = Router();

authRouter.post("/auth/login", async (req, res) => {
    await delay();
    const { email, password } = req.body ?? {};

    if (email !== DUMMY_CREDENTIALS.email || password !== DUMMY_CREDENTIALS.password) {
        res.status(401).json(unauthorized("Invalid email or password"));
        return;
    }

    // Real backend would set these as Set-Cookie headers; the client never
    // sees the token values, only the 200.
    issueSession(res);
    res.sendStatus(200);
});

authRouter.post("/auth/refresh", async (req, res) => {
    await delay();
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
        res.status(401).json(unauthorized("Missing or expired refresh token"));
        return;
    }

    issueSession(res);
    res.sendStatus(200);
});

authRouter.get("/auth/me", async (req, res) => {
    await delay();
    const user = getUserFromAccessToken(req.cookies?.access_token);

    if (!user) {
        res.status(401).json(unauthorized("Not authenticated"));
        return;
    }

    const body: JsonApiDataResponse<UserAttributes> = {
        data: {
            type: "users",
            id: user.id,
            attributes: { email: user.email, name: user.name },
        },
    };
    res.status(200).json(body);
});

authRouter.post("/auth/logout", async (_req, res) => {
    await delay();
    clearSession(res);
    res.sendStatus(200);
});
