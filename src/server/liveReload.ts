import crypto from "crypto";
import fs from "fs";
import type { Express, Request, Response } from "express";

// Live reload / new-version notice. The build id is a hash of the built
// bundles, so it changes on every rebuild or deploy but is identical across
// instances running the same build. When the server restarts, the browser's
// EventSource reconnects and sees a different id. LIVE_RELOAD picks what
// happens then: "auto" reloads, "prompt" shows a banner, "off" disables it.
// Defaults to "auto" in development and "prompt" in production.
export const LIVE_RELOAD_MODES = ["auto", "prompt", "off"] as const;
export type LiveReloadMode = (typeof LIVE_RELOAD_MODES)[number];

export interface LiveReloadModeResult {
    mode: LiveReloadMode;
    /** Set when the raw value was not a known mode and the default was used. */
    warning?: string;
}

export function resolveLiveReloadMode(raw: string | undefined, isDev: boolean): LiveReloadModeResult {
    const fallback: LiveReloadMode = isDev ? "auto" : "prompt";
    const normalized = (raw || fallback).toLowerCase();
    if ((LIVE_RELOAD_MODES as readonly string[]).includes(normalized)) {
        return { mode: normalized as LiveReloadMode };
    }
    return {
        mode: fallback,
        warning: `Unknown LIVE_RELOAD="${raw}", falling back to "${fallback}" (use auto | prompt | off)`,
    };
}

/** Short content hash of the given files; a missing file hashes its path instead. */
export function computeBuildId(files: string[]): string {
    const hash = crypto.createHash("sha1");
    for (const file of files) {
        try {
            hash.update(fs.readFileSync(file));
        } catch {
            hash.update(file);
        }
    }
    return hash.digest("hex").slice(0, 12);
}

/** Inline <script> injected into the HTML shell; empty when live reload is off. */
export function liveReloadClientScript(mode: LiveReloadMode, isDev: boolean): string {
    if (mode === "off") return "";
    return `<script>
        (function () {
            var mode = ${JSON.stringify(mode)};
            var buildId;

            function showPrompt() {
                if (document.getElementById("__livereload-prompt")) return;
                var bar = document.createElement("div");
                bar.id = "__livereload-prompt";
                bar.setAttribute("role", "alert");
                bar.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;display:flex;gap:12px;align-items:center;padding:10px 14px;border-radius:8px;background:#111827;color:#f9fafb;font:14px/1.4 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.25)";
                bar.innerHTML = '<span>A new version is available.</span>'
                    + '<button data-act="reload" style="padding:4px 10px;border:0;border-radius:6px;background:#f9fafb;color:#111827;cursor:pointer">Refresh</button>'
                    + '<button data-act="dismiss" style="padding:4px 10px;border:1px solid #6b7280;border-radius:6px;background:transparent;color:#f9fafb;cursor:pointer">Later</button>';
                bar.onclick = function (e) {
                    var act = e.target && e.target.getAttribute("data-act");
                    if (act === "reload") location.reload();
                    if (act === "dismiss") bar.remove();
                };
                document.body.appendChild(bar);
            }

            function connect() {
                var es = new EventSource("/__livereload");
                es.onmessage = function (e) {
                    if (buildId && buildId !== e.data) {
                        if (mode === "auto") return location.reload();
                        showPrompt();
                    }
                    buildId = e.data;
                };
                es.onerror = function () {
                    if (es.readyState === EventSource.CLOSED) setTimeout(connect, ${isDev ? 1000 : 10000});
                };
            }
            connect();
        })();
    </script>`;
}

export function registerLiveReloadEndpoint(app: Express, buildId: string, isDev: boolean): void {
    app.get("/__livereload", (req: Request, res: Response) => {
        res.set({
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no", // keep nginx from buffering the stream
        });
        res.flushHeaders();
        // Reconnect fast in dev; back off in prod so a deploy doesn't get
        // hammered by every open tab at once.
        res.write(`retry: ${isDev ? 500 : 5000}\ndata: ${buildId}\n\n`);
        const ping = setInterval(() => res.write(": ping\n\n"), 30000);
        req.on("close", () => clearInterval(ping));
    });
}
