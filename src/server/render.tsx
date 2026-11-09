import React from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { Provider } from "react-redux";
import serialize from "serialize-javascript";
import App from "../pages/App";
import { Loading } from "../components/loading";
import type { AppStore } from "../store";
import type { RouteContext } from "../types/routing";

/** Server-side tree. Must stay structurally identical to src/client/index.tsx. */
export function renderAppHtml(url: string, store: AppStore, context: RouteContext): string {
    return renderToString(
        <StaticRouter location={url}>
            <Provider store={store}>
                <Loading>
                    <App context={context} />
                </Loading>
            </Provider>
        </StaticRouter>
    );
}

/** Serialized state, safe to inline in a <script> (no `</script>` breakout). */
export function serializeState(state: unknown): string {
    return serialize(state).replace(/</g, "\\u003c");
}

interface HtmlDocumentOptions {
    appHtml: string;
    state: unknown;
    status: number;
    liveReloadScript: string;
}

export function htmlDocument({ appHtml, state, status, liveReloadScript }: HtmlDocumentOptions): string {
    return `
    <!DOCTYPE html>
    <html>
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />

            <title>${status === 404 ? "404 Not Found" : "SSR Boilerplate"}</title>

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
                window.__PRELOADED_STATE__ = ${serializeState(state)};
            </script>
            <script src="/bundle.js"></script>
            ${liveReloadScript}
        </body>
    </html>
  `;
}
