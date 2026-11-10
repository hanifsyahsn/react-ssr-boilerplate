import path from "node:path";
import { createApp, type AppConfig } from "../server/app";

/** createApp() with test-friendly defaults: no auth latency, live reload off. */
export function testApp(overrides: Partial<AppConfig> = {}) {
    return createApp({
        isDev: true,
        apiBaseUrl: "http://127.0.0.1:9", // nothing listens here; override to test the proxy
        clientDir: path.resolve(__dirname, "fixtures/client"),
        liveReloadMode: "off",
        buildId: "test-build",
        authLatencyMs: 0,
        ...overrides,
    });
}

/** Pulls `window.__PRELOADED_STATE__ = {...};` out of an SSR HTML document. */
export function preloadedState(html: string): any {
    const match = html.match(/window\.__PRELOADED_STATE__ = (.*);\s*<\/script>/);
    if (!match) throw new Error("no preloaded state in HTML");
    return new Function(`return (${match[1]});`)();
}
