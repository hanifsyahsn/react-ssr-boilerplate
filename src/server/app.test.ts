// @vitest-environment node
import http from "http";
import type { AddressInfo } from "net";
import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import express from "express";
import { AuthEnums } from "../enums/auth";
import { preloadedState, testApp } from "../test/testApp";

// Integration: the real Express app (SSR + static + mock auth + proxy).

function stubTodoApi(body: unknown = { title: "SSR todo" }) {
    const fetchMock = vi.fn(() => Promise.resolve({ json: () => Promise.resolve(body) }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

describe("SSR: page rendering", () => {
    it("server-renders the matched page inside #root with a 200", async () => {
        const res = await request(testApp()).get("/");

        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toMatch(/text\/html/);
        expect(res.text).toMatch(/<div id="root">.*<h1>Home<\/h1>.*<\/div>/s);
        expect(res.text).toContain("<title>SSR Boilerplate</title>");
    });

    it("includes the client bundle, stylesheet and the initial loader in the shell", async () => {
        const res = await request(testApp()).get("/");
        expect(res.text).toContain('<script src="/bundle.js"></script>');
        expect(res.text).toContain('<link rel="stylesheet" href="/styles.css" />');
        expect(res.text).toContain('id="server-loader"');
    });

    it("answers unknown paths with HTTP 404, a 404 title and the NotFound page", async () => {
        const res = await request(testApp()).get("/no/such/page");
        expect(res.status).toBe(404);
        expect(res.text).toContain("<title>404 Not Found</title>");
        expect(res.text).toContain("404 - Page Not Found");
    });
});

describe("SSR: data fetching", () => {
    it("runs the page's fetchData before render so the HTML already contains the data", async () => {
        const fetchMock = stubTodoApi({ title: "SSR todo" });
        const res = await request(testApp()).get("/about");

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(res.text).toContain("<p>SSR todo</p>");
        expect(preloadedState(res.text).data.about).toEqual({ title: "SSR todo" });
    });

    it("does not call fetchData for pages that do not define one", async () => {
        const fetchMock = stubTodoApi();
        await request(testApp()).get("/");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("still renders the page when the page's data API is down", async () => {
        vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("ECONNREFUSED"))));
        const res = await request(testApp()).get("/about");
        expect(res.status).toBe(200);
        expect(preloadedState(res.text).data.error).toBe("ECONNREFUSED");
    });
});

describe("SSR: auth and state hydration", () => {
    it("marks a visitor without a session cookie as UNAUTHENTICATED (no CHECKING flash)", async () => {
        const res = await request(testApp()).get("/");
        expect(preloadedState(res.text).data.auth).toEqual({ user: null, status: AuthEnums.UNAUTHENTICATED });
        expect(res.text).toMatch(/<a href="\/auth\/login"[^>]*>Login<\/a>/);
    });

    it("resolves the user from the session cookie and renders them logged in", async () => {
        const res = await request(testApp()).get("/").set("Cookie", "access_token=abc");
        const { auth } = preloadedState(res.text).data;
        expect(auth.status).toBe(AuthEnums.AUTHENTICATED);
        expect(auth.user).toEqual({ id: "1", email: "demo@example.com", name: "Demo User" });
        expect(res.text).toContain("Demo User");
    });

    it("escapes `<` in the inlined state so data cannot break out of the <script> tag", async () => {
        stubTodoApi({ title: "</script><script>alert(1)</script>" });
        const res = await request(testApp()).get("/about");
        const stateScript = res.text.match(/window\.__PRELOADED_STATE__ = (.*);/)![1];

        expect(stateScript).not.toContain("</script>");
        expect(preloadedState(res.text).data.about.title).toBe("</script><script>alert(1)</script>");
    });

    it("gives each request a fresh store (no state leaks between users)", async () => {
        const app = testApp();
        await request(app).get("/").set("Cookie", "access_token=abc");
        const anonymous = await request(app).get("/");
        expect(preloadedState(anonymous.text).data.auth.user).toBeNull();
    });
});

describe("static files", () => {
    it("serves the built client bundle and stylesheet", async () => {
        const app = testApp();
        const js = await request(app).get("/bundle.js");
        expect(js.status).toBe(200);
        expect(js.text).toContain("test bundle");
        expect((await request(app).get("/styles.css")).status).toBe(200);
    });
});

describe("/api proxy", () => {
    let upstream: http.Server | undefined;
    afterEach(() => upstream?.close());

    function startUpstream(): Promise<string> {
        const api = express();
        api.use(express.json());
        api.all(/.*/, (req, res) => {
            res.json({ method: req.method, path: req.originalUrl, body: req.body, cookie: req.headers.cookie });
        });
        return new Promise((resolve) => {
            upstream = api.listen(0, "127.0.0.1", () =>
                resolve(`http://127.0.0.1:${(upstream!.address() as AddressInfo).port}`)
            );
        });
    }

    it("forwards non-auth /api requests to API_BASE_URL without the /api prefix", async () => {
        const app = testApp({ apiBaseUrl: await startUpstream() });
        const res = await request(app).get("/api/todos/1?x=1").set("Cookie", "access_token=abc");

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ method: "GET", path: "/todos/1?x=1", cookie: "access_token=abc" });
    });

    it("keeps handling /api/auth/* locally instead of proxying it", async () => {
        const app = testApp({ apiBaseUrl: await startUpstream() });
        const res = await request(app).get("/api/auth/me");
        expect(res.status).toBe(401);
        expect(res.body.errors).toBeDefined();
    });
});

describe("live reload wiring", () => {
    it("injects the live reload script and exposes /__livereload when enabled", async () => {
        const app = testApp({ liveReloadMode: "prompt", buildId: "abc123" });
        const page = await request(app).get("/");
        expect(page.text).toContain('new EventSource("/__livereload")');
        expect(page.text).toContain('var mode = "prompt"');

        const res = await request(app)
            .get("/__livereload")
            .buffer(true)
            .parse((stream, cb) => {
                let data = "";
                stream.on("data", (chunk: Buffer) => {
                    data += chunk.toString();
                    (stream as any).destroy();
                    cb(null, data);
                });
            });
        expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
        expect(res.headers["cache-control"]).toBe("no-cache");
        expect(res.body).toBe("retry: 500\ndata: abc123\n\n");
    });

    it("injects no script and has no endpoint when LIVE_RELOAD is off", async () => {
        const app = testApp({ liveReloadMode: "off" });
        const page = await request(app).get("/");
        expect(page.text).not.toContain("EventSource");
        expect((await request(app).get("/__livereload")).status).toBe(404);
    });
});
