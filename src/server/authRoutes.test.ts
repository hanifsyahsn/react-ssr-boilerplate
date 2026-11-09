// @vitest-environment node
import { describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { createAuthRouter, MOCK_LATENCY_MS } from "./authRoutes";
import { testApp } from "../test/testApp";

const app = testApp();
const VALID = { email: "demo@example.com", password: "password123" };

function cookieNames(res: request.Response): Record<string, string> {
    const raw = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
    return Object.fromEntries(raw.map((c) => [c.split("=")[0], c]));
}

describe("POST /api/auth/login", () => {
    it("sets httpOnly access and refresh cookies for valid credentials", async () => {
        const res = await request(app).post("/api/auth/login").send(VALID);

        expect(res.status).toBe(200);
        const cookies = cookieNames(res);
        expect(cookies.access_token).toMatch(/HttpOnly/);
        expect(cookies.access_token).toMatch(/SameSite=Lax/);
        expect(cookies.access_token).toMatch(/Max-Age=900;/); // 15 minutes
        expect(cookies.refresh_token).toMatch(/HttpOnly/);
        expect(cookies.refresh_token).toMatch(/Max-Age=604800;/); // 7 days
    });

    it("never exposes token values in the response body", async () => {
        const res = await request(app).post("/api/auth/login").send(VALID);
        expect(res.text).not.toMatch(/dummy-/);
    });

    it.each([
        ["wrong password", { email: VALID.email, password: "nope" }],
        ["unknown email", { email: "x@y.z", password: VALID.password }],
        ["empty body", {}],
    ])("rejects %s with a JSON:API 401 and no cookies", async (_case, body) => {
        const res = await request(app).post("/api/auth/login").send(body);

        expect(res.status).toBe(401);
        expect(res.body).toEqual({
            errors: [{ status: "401", title: "Unauthorized", detail: "Invalid email or password" }],
        });
        expect(res.headers["set-cookie"]).toBeUndefined();
    });

    it("rejects a request without a JSON body", async () => {
        const res = await request(app).post("/api/auth/login");
        expect(res.status).toBe(401);
    });
});

describe("POST /api/auth/refresh", () => {
    it("rotates both cookies when a refresh token is present (sliding session)", async () => {
        const res = await request(app).post("/api/auth/refresh").set("Cookie", "refresh_token=abc");
        expect(res.status).toBe(200);
        expect(Object.keys(cookieNames(res)).sort()).toEqual(["access_token", "refresh_token"]);
    });

    it("returns 401 without a refresh token", async () => {
        const res = await request(app).post("/api/auth/refresh");
        expect(res.status).toBe(401);
        expect(res.body.errors[0].detail).toBe("Missing or expired refresh token");
    });
});

describe("GET /api/auth/me", () => {
    it("returns the user as a JSON:API resource for a valid session", async () => {
        const res = await request(app).get("/api/auth/me").set("Cookie", "access_token=abc");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            data: { type: "users", id: "1", attributes: { email: "demo@example.com", name: "Demo User" } },
        });
    });

    it("returns 401 without a session", async () => {
        const res = await request(app).get("/api/auth/me");
        expect(res.status).toBe(401);
        expect(res.body.errors[0].detail).toBe("Not authenticated");
    });
});

describe("POST /api/auth/logout", () => {
    it("clears both session cookies", async () => {
        const res = await request(app).post("/api/auth/logout").set("Cookie", "access_token=a; refresh_token=b");
        expect(res.status).toBe(200);
        const cookies = cookieNames(res);
        expect(cookies.access_token).toMatch(/Expires=Thu, 01 Jan 1970/);
        expect(cookies.refresh_token).toMatch(/Expires=Thu, 01 Jan 1970/);
    });
});

describe("full session flow", () => {
    it("login -> me -> logout -> me is rejected", async () => {
        const agent = request.agent(app);

        await agent.post("/api/auth/login").send(VALID).expect(200);
        await agent.get("/api/auth/me").expect(200);
        await agent.post("/api/auth/logout").expect(200);
        await agent.get("/api/auth/me").expect(401);
    });
});

describe("mock latency", () => {
    it(`waits ${MOCK_LATENCY_MS}ms by default before answering, like a real network call`, async () => {
        const mini = express().use(cookieParser(), express.json(), createAuthRouter());
        const started = performance.now();

        const res = await request(mini).post("/auth/logout");

        expect(res.status).toBe(200);
        expect(performance.now() - started).toBeGreaterThanOrEqual(MOCK_LATENCY_MS - 20);
    });
});
