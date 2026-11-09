// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testApp } from "../test/testApp";

// Server contract for pages, tested with purpose-built routes (src/test/fixtureRoutes.tsx)
// instead of the real route table: context.url redirects, crashing pages, protected pages.

vi.mock("../routes", () => import("../test/fixtureRoutes"));

describe("SSR page contract", () => {
    it("answers with a 301 to context.url when a page sets it during render", async () => {
        const res = await request(testApp()).get("/moved");
        expect(res.status).toBe(301);
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

    it("does not render a protected page's content for a logged-out visitor", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        const res = await request(testApp()).get("/secret");
        expect(res.text).not.toContain("secret page");
    });

    it("falls back to the * route when nothing else matches", async () => {
        const res = await request(testApp()).get("/zzz");
        expect(res.status).toBe(200);
        expect(res.text).toContain("fallback");
    });
});
