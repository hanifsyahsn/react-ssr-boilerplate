import path from "path";
import fs from "fs";
import crypto from "crypto";
import express from "express";
import type { Request, Response } from "express";
import React from "react";
import { renderToString } from "react-dom/server";
import App from "../pages/App";
import { StaticRouter } from "react-router-dom/server";
import { Provider } from "react-redux";
import { createStore, setAuthUnauthenticated, setAuthUser } from "../store";
import serialize from "serialize-javascript";
import cookieParser from "cookie-parser";
import { routes } from "../routes";
import { match as pathMatch } from "path-to-regexp";
import { createProxyMiddleware } from "http-proxy-middleware";
import dotenv from "dotenv";
import { Loading } from "../components/loading";
import { authRouter } from "./authRoutes";
import { getUserFromAccessToken } from "./mockAuth";
import type { RouteContext } from "../types/routing";

dotenv.config();

const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== "production";
const app = express();

// Live reload / new-version notice. The build id is a hash of the built
// bundles, so it changes on every rebuild or deploy but is identical across
// instances running the same build. When the server restarts, the browser's
// EventSource reconnects and sees a different id. LIVE_RELOAD picks what
// happens then: "auto" reloads, "prompt" shows a banner, "off" disables it.
// Defaults to "auto" in development and "prompt" in production.
const LIVE_RELOAD_MODES = ["auto", "prompt", "off"] as const;
type LiveReloadMode = (typeof LIVE_RELOAD_MODES)[number];

const defaultLiveReload: LiveReloadMode = isDev ? "auto" : "prompt";
const rawLiveReload = (process.env.LIVE_RELOAD || defaultLiveReload).toLowerCase();
const liveReloadMode: LiveReloadMode = (LIVE_RELOAD_MODES as readonly string[]).includes(rawLiveReload)
    ? (rawLiveReload as LiveReloadMode)
    : defaultLiveReload;
if (rawLiveReload !== liveReloadMode) {
    console.warn(`Unknown LIVE_RELOAD="${process.env.LIVE_RELOAD}", falling back to "${defaultLiveReload}" (use auto | prompt | off)`);
}
const liveReloadEnabled = liveReloadMode !== "off";

function computeBuildId(): string {
    const hash = crypto.createHash("sha1");
    const files = [
        path.resolve(__dirname, "../../dist/client/bundle.js"),
        path.resolve(__dirname, "../../dist/client/styles.css"),
        path.resolve(__dirname, "../../dist/server/server.js"),
    ];
    for (const file of files) {
        try {
            hash.update(fs.readFileSync(file));
        } catch {
            hash.update(file);
        }
    }
    return hash.digest("hex").slice(0, 12);
}

const BUILD_ID = computeBuildId();
const liveReloadScript = liveReloadEnabled
    ? `<script>
        (function () {
            var mode = ${JSON.stringify(liveReloadMode)};
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
    </script>`
    : "";

if (liveReloadEnabled) {
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
        res.write(`retry: ${isDev ? 500 : 5000}\ndata: ${BUILD_ID}\n\n`);
        const ping = setInterval(() => res.write(": ping\n\n"), 30000);
        req.on("close", () => clearInterval(ping));
    });
}

app.use(express.static(path.resolve(__dirname, "../../dist/client")));

app.use(cookieParser());
app.use(express.json());

// Dummy auth backend for this boilerplate - intercepts /api/auth/* before
// the proxy below forwards everything else to the real API.
app.use("/api", authRouter);

app.use(
    "/api",
    createProxyMiddleware({
        target: process.env.API_BASE_URL,
        changeOrigin: true,
    })
);

app.get(/.*/, async (req: Request, res: Response) => {
    try {
        const store = createStore();
        const context: RouteContext = {};

        // Resolve auth from the session cookie up front so the very first
        // render (and PrivateRoute) already knows the user's auth status -
        // no CHECKING flash and no client-side re-fetch of `me` on load.
        const user = getUserFromAccessToken(req.cookies?.access_token);
        if (user) {
            store.dispatch(setAuthUser({ user }));
        } else {
            store.dispatch(setAuthUnauthenticated());
        }

        const matchedRoute =
            routes.find(r => r.path !== "*" && pathMatch(r.path, { decode: decodeURIComponent })(req.path))
            || routes.find(r => r.path === "*");

        if (matchedRoute?.component?.fetchData) {
            await matchedRoute.component.fetchData(store);
        }

        const appHtml = renderToString(
            <StaticRouter location={req.url}>
                <Provider store={store}>
                    <Loading>
                        <App context={context} />
                    </Loading>
                </Provider>
            </StaticRouter>
        )

        const status = context.status || 200;

        if (context.url) {
            return res.redirect(301, context.url)
        }

        if (status === 404) {
            res.status(status);
        }

        const html = `
    <!DOCTYPE html>
    <html>
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />

            <title>${status === 404 ? '404 Not Found' : 'SSR Boilerplate'}</title>

            <link rel="stylesheet" href="/styles.css" />

            <link
                href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />

        </head>
        <body>

        <div
            id="server-loader"
            role="status"
            aria-live="polite"
            class="fixed inset-0 z-[999999] flex items-center justify-center bg-gray-50/75 backdrop-blur-sm"
        >
            <div class="relative">
                <div class="relative w-32 h-32">
                    <div
                        class="absolute w-full h-full rounded-full border-[3px] border-gray-200 border-r-gray-600 border-b-gray-600 animate-spin"
                        style="animation-duration: 3s;"
                    ></div>
                    <div
                        class="absolute w-full h-full rounded-full border-[3px] border-gray-200 border-t-gray-600 animate-spin"
                        style="animation-duration: 2s; animation-direction: reverse;"
                    ></div>
                </div>
                <div class="absolute inset-0 bg-gradient-to-tr from-gray-400/20 via-transparent to-gray-400/10 animate-pulse rounded-full blur-sm"></div>
            </div>
            <span class="sr-only">Loading…</span>
        </div>


            <div id="root">${appHtml}</div>
            <script>
                window.__PRELOADED_STATE__ = ${serialize(store.getState()).replace(
            /</g,
            "\\u003c"
        )};
            </script>
            <script src="/bundle.js"></script>
            ${liveReloadScript}
        </body>
    </html>
  `;
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
