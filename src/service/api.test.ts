import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import api from "./api";
import { setStore } from "../store/storeRef";
import { AuthEnums } from "../enums/auth";
import { API, apiError, server, useMswServer } from "../test/mswServer";
import { authenticated, makeStore } from "../test/render";

useMswServer();

/** Counts calls per endpoint so tests can assert retries and refreshes. */
function track() {
    const calls: Record<string, number> = {};
    server.events.on("request:start", ({ request }) => {
        const key = `${request.method} ${new URL(request.url).pathname}`;
        calls[key] = (calls[key] ?? 0) + 1;
    });
    return calls;
}

beforeEach(() => {
    server.events.removeAllListeners();
});

describe("api client", () => {
    it("sends requests to /api with credentials (cookies) included", async () => {
        server.use(http.get(`${API}/things`, () => HttpResponse.json({ ok: true })));
        const res = await api.get("/things");
        expect(res.config.baseURL).toBe("/api");
        expect(res.config.withCredentials).toBe(true);
        expect(res.data).toEqual({ ok: true });
    });

    it("passes non-401 errors straight through without refreshing", async () => {
        const calls = track();
        server.use(http.get(`${API}/things`, () => new HttpResponse(null, { status: 500 })));

        await expect(api.get("/things")).rejects.toMatchObject({ response: { status: 500 } });
        expect(calls["POST /api/auth/refresh"]).toBeUndefined();
    });
});

describe("api client: expired session (401)", () => {
    it("refreshes the session once and retries the original request", async () => {
        const calls = track();
        let attempts = 0;
        server.use(
            http.get(`${API}/things`, () => {
                attempts += 1;
                return attempts === 1 ? apiError(401, "expired") : HttpResponse.json({ ok: "after refresh" });
            })
        );

        const res = await api.get("/things");

        expect(res.data).toEqual({ ok: "after refresh" });
        expect(calls["POST /api/auth/refresh"]).toBe(1);
        expect(calls["GET /api/things"]).toBe(2);
    });

    it("logs the user out in the store when the refresh fails", async () => {
        const store = makeStore(authenticated);
        setStore(store);
        server.use(
            http.get(`${API}/things`, () => apiError(401, "expired")),
            http.post(`${API}/auth/refresh`, () => apiError(401, "Missing or expired refresh token"))
        );

        await expect(api.get("/things")).rejects.toMatchObject({ response: { status: 401 } });
        expect(store.getState().data.auth.status).toBe(AuthEnums.UNAUTHENTICATED);
    });

    it("does not loop: a request that is still 401 after the refresh is rejected", async () => {
        const calls = track();
        server.use(http.get(`${API}/things`, () => apiError(401, "still expired")));

        await expect(api.get("/things")).rejects.toMatchObject({ response: { status: 401 } });
        expect(calls["POST /api/auth/refresh"]).toBe(1);
        expect(calls["GET /api/things"]).toBe(2);
    });

    it.each(["/auth/login", "/auth/register", "/auth/refresh"])(
        "never tries to refresh for a 401 from %s (wrong password is not an expired session)",
        async (path) => {
            const calls = track();
            server.use(
                http.post(`${API}${path}`, () => apiError(401, "nope")),
            );

            await expect(api.post(path)).rejects.toMatchObject({ response: { status: 401 } });
            expect(calls["POST /api/auth/refresh"] ?? 0).toBe(path === "/auth/refresh" ? 1 : 0);
        }
    );

    it("rejects a network error (no response) without refreshing", async () => {
        const calls = track();
        server.use(http.get(`${API}/things`, () => HttpResponse.error()));

        await expect(api.get("/things")).rejects.toThrow();
        expect(calls["POST /api/auth/refresh"]).toBeUndefined();
    });
});
