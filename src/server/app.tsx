import express from "express";
import type { Express, Request, Response } from "express";
import cookieParser from "cookie-parser";
import { match as pathMatch } from "path-to-regexp";
import { createProxyMiddleware } from "http-proxy-middleware";
import { createStore, setAuthUnauthenticated, setAuthUser } from "../store";
import { routes } from "../routes";
import { createAuthRouter } from "./authRoutes";
import { getUserFromAccessToken } from "./mockAuth";
import { liveReloadClientScript, registerLiveReloadEndpoint, type LiveReloadMode } from "./liveReload";
import { htmlDocument, renderAppHtml } from "./render";
import type { RouteContext } from "../types/routing";

export interface AppConfig {
    isDev: boolean;
    /** Backend that `/api/*` (except the mock `/api/auth/*`) is proxied to. */
    apiBaseUrl: string;
    /** Directory with the built client bundle (bundle.js, styles.css). */
    clientDir: string;
    liveReloadMode: LiveReloadMode;
    buildId: string;
    /** Simulated latency of the mock auth endpoints. */
    authLatencyMs?: number;
}

/**
 * Decodes the request path the way React Router does on the client, so the
 * server picks the same route (and runs its fetchData) for "/%61bout" as the
 * client renders for "/about". A malformed escape like "/%E0" is matched as-is.
 */
function decodedPath(rawPath: string): string {
    try {
        return decodeURI(rawPath);
    } catch {
        return rawPath;
    }
}

export function createApp(config: AppConfig): Express {
    const app = express();
    const liveReloadScript = liveReloadClientScript(config.liveReloadMode, config.isDev);

    if (config.liveReloadMode !== "off") {
        registerLiveReloadEndpoint(app, config.buildId, config.isDev);
    }

    app.use(express.static(config.clientDir));

    app.use(cookieParser());
    app.use(express.json());

    // Dummy auth backend for this boilerplate - intercepts /api/auth/* before
    // the proxy below forwards everything else to the real API.
    app.use("/api", createAuthRouter(config.authLatencyMs));

    app.use(
        "/api",
        createProxyMiddleware({
            target: config.apiBaseUrl,
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

            const path = decodedPath(req.path);
            const matchedRoute =
                routes.find((r) => r.path !== "*" && pathMatch(r.path)(path)) ||
                routes.find((r) => r.path === "*");

            // The server already knows the auth status, so a protected page is
            // never rendered for a logged-out visitor: redirect before render.
            // 302, not 301: browsers cache a 301 forever, which would keep
            // bouncing the user to the login page even after they log in.
            if (matchedRoute?.protected && !user) {
                return res.redirect(302, "/auth/login");
            }

            if (matchedRoute?.component?.fetchData) {
                await matchedRoute.component.fetchData(store);
            }

            const appHtml = renderAppHtml(req.url, store, context);

            // Temporary (302) on purpose; see the protected-route redirect above.
            if (context.url) {
                return res.redirect(302, context.url);
            }

            const status = context.status || 200;
            if (status === 404) {
                res.status(status);
            }

            res.setHeader("Content-Type", "text/html");
            res.send(htmlDocument({ appHtml, state: store.getState(), status, liveReloadScript }));
        } catch (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
        }
    });

    return app;
}
