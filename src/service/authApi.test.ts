import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { fetchMe, login, logout, refresh } from "./authApi";
import { API, apiError, server, setupMswServer } from "../test/mswServer";
import { TEST_USER } from "../test/render";

setupMswServer();

describe("authApi.login", () => {
    it("posts the credentials to /api/auth/login and resolves on 200", async () => {
        let body: unknown;
        server.use(
            http.post(`${API}/auth/login`, async ({ request }) => {
                body = await request.json();
                return new HttpResponse(null, { status: 200 });
            })
        );

        await expect(login({ email: "a@b.c", password: "pw" })).resolves.toBeUndefined();
        expect(body).toEqual({ email: "a@b.c", password: "pw" });
    });

    it("throws the API's error detail on failure", async () => {
        await expect(login({ email: "bad", password: "bad" })).rejects.toThrow("Invalid email or password");
    });

    it("throws the API's error title when the error has no detail", async () => {
        server.use(
            http.post(`${API}/auth/login`, () =>
                HttpResponse.json({ errors: [{ status: "429", title: "Too Many Requests" }] }, { status: 429 })
            )
        );
        await expect(login({ email: "a", password: "b" })).rejects.toThrow("Too Many Requests");
    });

    it("throws a generic message when the error body is not JSON:API", async () => {
        server.use(http.post(`${API}/auth/login`, () => new HttpResponse("oops", { status: 500 })));
        await expect(login({ email: "a", password: "b" })).rejects.toThrow("Failed to log in");
    });

    it("throws a generic message on a network error", async () => {
        server.use(http.post(`${API}/auth/login`, () => HttpResponse.error()));
        await expect(login({ email: "a", password: "b" })).rejects.toThrow("Failed to log in");
    });
});

describe("authApi.fetchMe", () => {
    it("flattens the JSON:API user resource into a User", async () => {
        await expect(fetchMe()).resolves.toEqual(TEST_USER);
    });

    it("throws a generic message when the user cannot be loaded", async () => {
        server.use(
            http.get(`${API}/auth/me`, () => new HttpResponse(null, { status: 500 })),
        );
        await expect(fetchMe()).rejects.toThrow("Failed to load current user");
    });
});

describe("authApi.refresh", () => {
    it("resolves when the session is refreshed", async () => {
        await expect(refresh()).resolves.toBeUndefined();
    });

    it("throws the API's error detail when the refresh token is missing", async () => {
        server.use(http.post(`${API}/auth/refresh`, () => apiError(401, "Missing or expired refresh token")));
        await expect(refresh()).rejects.toThrow("Missing or expired refresh token");
    });
});

describe("authApi.logout", () => {
    it("resolves when the session is cleared", async () => {
        await expect(logout()).resolves.toBeUndefined();
    });

    it("throws a generic message when logout fails", async () => {
        server.use(http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 503 })));
        await expect(logout()).rejects.toThrow("Failed to log out");
    });
});
