import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "events";
import {
    computeBuildId,
    liveReloadClientScript,
    registerLiveReloadEndpoint,
    resolveLiveReloadMode,
    type LiveReloadMode,
} from "./liveReload";

describe("resolveLiveReloadMode (LIVE_RELOAD env var)", () => {
    it("defaults to auto in development and prompt in production", () => {
        expect(resolveLiveReloadMode(undefined, true)).toEqual({ mode: "auto" });
        expect(resolveLiveReloadMode(undefined, false)).toEqual({ mode: "prompt" });
        expect(resolveLiveReloadMode("", false)).toEqual({ mode: "prompt" });
    });

    it.each(["auto", "prompt", "off", "OFF", "Prompt"])("accepts %s (case-insensitive)", (raw) => {
        expect(resolveLiveReloadMode(raw, true)).toEqual({ mode: raw.toLowerCase() });
    });

    it("falls back to the environment default with a warning for an unknown value", () => {
        const result = resolveLiveReloadMode("sometimes", false);
        expect(result.mode).toBe("prompt");
        expect(result.warning).toBe('Unknown LIVE_RELOAD="sometimes", falling back to "prompt" (use auto | prompt | off)');
    });
});

describe("computeBuildId", () => {
    let dir: string;
    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "buildid-"));
    });
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

    const write = (name: string, content: string) => {
        const file = path.join(dir, name);
        fs.writeFileSync(file, content);
        return file;
    };

    it("is a 12-character hex id that stays the same for the same build", () => {
        const files = [write("a.js", "one"), write("b.css", "two")];
        const id = computeBuildId(files);
        expect(id).toMatch(/^[0-9a-f]{12}$/);
        expect(computeBuildId(files)).toBe(id);
    });

    it("changes when any bundle's content changes (a rebuild or deploy)", () => {
        const files = [write("a.js", "one"), write("b.css", "two")];
        const before = computeBuildId(files);
        write("b.css", "two-changed");
        expect(computeBuildId(files)).not.toBe(before);
    });

    it("does not crash when a bundle is missing (e.g. before the first build)", () => {
        expect(computeBuildId([path.join(dir, "missing.js")])).toMatch(/^[0-9a-f]{12}$/);
    });
});

// Runs the inline <script> in jsdom with a fake EventSource, timer and reload.
class FakeEventSource {
    static CLOSED = 2;
    static instances: FakeEventSource[] = [];
    readyState = 1;
    onmessage: ((e: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public url: string) {
        FakeEventSource.instances.push(this);
    }
    emit(data: string) {
        this.onmessage?.({ data });
    }
}

function runScript(mode: LiveReloadMode, isDev = true) {
    const html = liveReloadClientScript(mode, isDev);
    const body = html.replace(/^\s*<script>/, "").replace(/<\/script>\s*$/, "");
    const reload = vi.fn();
    const setTimeoutFake = vi.fn();
    FakeEventSource.instances = [];
    new Function("location", "EventSource", "setTimeout", body)({ reload }, FakeEventSource, setTimeoutFake);
    const latest = () => FakeEventSource.instances[FakeEventSource.instances.length - 1];
    return { reload, setTimeoutFake, latest };
}

const banner = () => document.getElementById("__livereload-prompt");

describe("live reload client script", () => {
    afterEach(() => banner()?.remove());

    it("is empty when live reload is off", () => {
        expect(liveReloadClientScript("off", true)).toBe("");
    });

    it("connects to /__livereload on page load", () => {
        const { latest } = runScript("auto");
        expect(latest().url).toBe("/__livereload");
    });

    it("does nothing on the first build id or when the same build id is sent again", () => {
        const { reload, latest } = runScript("auto");
        latest().emit("build-1");
        latest().emit("build-1");
        expect(reload).not.toHaveBeenCalled();
        expect(banner()).toBeNull();
    });

    it("auto mode: reloads the page when the server reports a new build", () => {
        const { reload, latest } = runScript("auto");
        latest().emit("build-1");
        latest().emit("build-2");
        expect(reload).toHaveBeenCalledTimes(1);
        expect(banner()).toBeNull();
    });

    it("prompt mode: shows a 'new version' banner instead of reloading", () => {
        const { reload, latest } = runScript("prompt");
        latest().emit("build-1");
        latest().emit("build-2");
        expect(reload).not.toHaveBeenCalled();
        expect(banner()).toHaveAttribute("role", "alert");
        expect(banner()).toHaveTextContent("A new version is available.");
    });

    it("prompt mode: shows only one banner for several new builds", () => {
        const { latest } = runScript("prompt");
        latest().emit("build-1");
        latest().emit("build-2");
        latest().emit("build-3");
        expect(document.querySelectorAll("#__livereload-prompt")).toHaveLength(1);
    });

    it("prompt mode: Refresh reloads the page", () => {
        const { reload, latest } = runScript("prompt");
        latest().emit("build-1");
        latest().emit("build-2");
        (banner()!.querySelector('[data-act="reload"]') as HTMLElement).click();
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it("prompt mode: Later dismisses the banner without reloading", () => {
        const { reload, latest } = runScript("prompt");
        latest().emit("build-1");
        latest().emit("build-2");
        (banner()!.querySelector('[data-act="dismiss"]') as HTMLElement).click();
        expect(banner()).toBeNull();
        expect(reload).not.toHaveBeenCalled();
    });

    it("prompt mode: clicking the banner text does nothing", () => {
        const { reload, latest } = runScript("prompt");
        latest().emit("build-1");
        latest().emit("build-2");
        (banner()!.querySelector("span") as HTMLElement).click();
        expect(banner()).not.toBeNull();
        expect(reload).not.toHaveBeenCalled();
    });

    it.each([
        [true, 1000],
        [false, 10000],
    ])("reconnects after the connection is closed (dev=%s waits %ims)", (isDev, wait) => {
        const { setTimeoutFake, latest } = runScript("auto", isDev);
        const es = latest();
        es.readyState = FakeEventSource.CLOSED;
        es.onerror!();
        expect(setTimeoutFake).toHaveBeenCalledWith(expect.any(Function), wait);

        setTimeoutFake.mock.calls[0][0]();
        expect(FakeEventSource.instances).toHaveLength(2);
    });

    it("lets the browser retry by itself on a transient error (connection not closed)", () => {
        const { setTimeoutFake, latest } = runScript("auto");
        latest().onerror!();
        expect(setTimeoutFake).not.toHaveBeenCalled();
    });
});

describe("/__livereload endpoint", () => {
    function connect(isDev: boolean) {
        let handler!: (req: any, res: any) => void;
        const app = { get: (_path: string, h: typeof handler) => (handler = h) } as any;
        registerLiveReloadEndpoint(app, "build-xyz", isDev);

        const req = new EventEmitter();
        const res = { set: vi.fn(), flushHeaders: vi.fn(), write: vi.fn() };
        handler(req, res);
        return { req, res };
    }

    afterEach(() => vi.useRealTimers());

    it("tells the browser to reconnect after 500ms in dev and 5s in production", () => {
        expect(connect(true).res.write).toHaveBeenCalledWith("retry: 500\ndata: build-xyz\n\n");
        expect(connect(false).res.write).toHaveBeenCalledWith("retry: 5000\ndata: build-xyz\n\n");
    });

    it("disables proxy buffering so the event reaches the browser immediately", () => {
        const { res } = connect(true);
        expect(res.set).toHaveBeenCalledWith(expect.objectContaining({ "X-Accel-Buffering": "no" }));
        expect(res.flushHeaders).toHaveBeenCalled();
    });

    it("sends a keep-alive ping every 30 seconds until the browser disconnects", () => {
        vi.useFakeTimers();
        const { req, res } = connect(true);
        res.write.mockClear();

        vi.advanceTimersByTime(30000);
        expect(res.write).toHaveBeenCalledWith(": ping\n\n");
        expect(res.write).toHaveBeenCalledTimes(1);

        req.emit("close");
        vi.advanceTimersByTime(60000);
        expect(res.write).toHaveBeenCalledTimes(1);
    });
});
