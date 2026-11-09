// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { preloadedState, testApp } from "../test/testApp";

// Server contract for pages, tested with purpose-built routes (src/test/fixtureRoutes.tsx)
// instead of the real route table: context.url redirects, crashing pages, protected pages.

vi.mock("../routes", () => import("../test/fixtureRoutes"));

describe("SSR page contract", () => {
    it("answers with a temporary 302 to context.url when a page sets it during render", async () => {
        const res = await request(testApp()).get("/moved");
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/new-home");
    });

    it("answers 500 without leaking details when a page throws while rendering", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const res = await request(testApp()).get("/crash");
        expect(res.status).toBe(500);
        expect(res.text).toBe("Internal Server Error");
        expect(error).toHaveBeenCalled();
    });

    it("answers 500 when a page's fetchData throws", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const res = await request(testApp()).get("/broken-data");
        expect(res.status).toBe(500);
    });

    it("renders a protected page for a logged-in visitor", async () => {
        const res = await request(testApp()).get("/secret").set("Cookie", "access_token=abc");
        expect(res.status).toBe(200);
        expect(res.text).toContain("secret page");
    });

    it("redirects a logged-out visitor of a protected page to /auth/login with a 302, before rendering", async () => {
        const res = await request(testApp()).get("/secret");
        expect(res.status).toBe(302); // not 301: browsers would cache it and keep bouncing after login
        expect(res.headers.location).toBe("/auth/login");
        expect(res.text).not.toContain("secret page");
    });

    it("matches the route for a percent-encoded path, like React Router does on the client", async () => {
        const res = await request(testApp()).get("/caf%C3%A9");
        expect(res.status).toBe(200);
        expect(res.text).toContain("cafe page");
        expect(preloadedState(res.text).data.about).toEqual({ matched: "café" }); // its fetchData ran
    });

    it("does not crash on a malformed percent-encoding and falls back to the * route", async () => {
        const res = await request(testApp()).get("/%E0%A4%A");
        expect(res.status).toBe(200);
        expect(res.text).toContain("fallback");
    });

    it("falls back to the * route when nothing else matches", async () => {
        const res = await request(testApp()).get("/zzz");
        expect(res.status).toBe(200);
        expect(res.text).toContain("fallback");
    });
});
