import type { CookieOptions, Response } from "express";
import type { User } from "../types/auth";

// This is a dummy backend for the boilerplate: no real database or token
// signing. Swap this module out once a real auth API is available - every
// consumer (authRoutes.ts, server.tsx) only depends on the functions below.
export const DUMMY_CREDENTIALS = {
    email: "demo@example.com",
    password: "password123",
};

export const DUMMY_USER: User = {
    id: "1",
    email: DUMMY_CREDENTIALS.email,
    name: "Demo User",
};

const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

const cookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
};

// Sliding session: both tokens are re-issued on login *and* on every
// refresh, so an active user's session keeps extending instead of expiring
// on a fixed schedule.
export function issueSession(res: Response): void {
    res.cookie("access_token", `dummy-access-${Date.now()}`, {
        ...cookieOptions,
        maxAge: ACCESS_TOKEN_MAX_AGE,
    });
    res.cookie("refresh_token", `dummy-refresh-${Date.now()}`, {
        ...cookieOptions,
        maxAge: REFRESH_TOKEN_MAX_AGE,
    });
}

export function clearSession(res: Response): void {
    res.clearCookie("access_token", cookieOptions);
    res.clearCookie("refresh_token", cookieOptions);
}

export function getUserFromAccessToken(accessToken?: string): User | null {
    return accessToken ? DUMMY_USER : null;
}
