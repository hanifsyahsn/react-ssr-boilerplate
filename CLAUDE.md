# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

There is no test suite or linter configured in this project (no jest/vitest/eslint config present).

```bash
npm run dev          # dev server: rebuilds client+server bundles on change (watches src/, src/client) then runs dist/server/server.js
npm run devx         # same as dev but only watches src/ (no explicit src/client watch)
npm run build        # build:client + build:server (webpack, production or dev mode based on NODE_ENV)
npm run build:client # webpack.client.js -> dist/client/bundle.js + dist/client/styles.css
npm run build:server # webpack.server.js -> dist/server/server.js (bundled for node, deps externalized)
npm start            # NODE_ENV=production node dist/server/server.js (run build first)
```

There is no hot-reload dev server — `dev`/`devx` do a full rebuild-and-restart on every file change via nodemon, so changes take a few seconds to appear. The server exposes an SSE endpoint `/__livereload` that sends a build id (hash of the built bundles) and injects a small script into the HTML shell; when a restarted/redeployed server reports a different build id, open tabs react according to `LIVE_RELOAD`: `auto` (reload immediately — default in dev), `prompt` (show a "new version available" Refresh/Later banner — default in production), or `off` (no endpoint, no script).

`.env` sets `API_BASE_URL` (backend the `/api` requests are proxied to) and `LIVE_RELOAD` (`auto` | `prompt` | `off`). `PORT` defaults to 3000 if unset.

## Architecture

This is a hand-rolled (no framework like Next.js) React SSR boilerplate: one Express server does both SSR HTML rendering and serves the client bundle, with Redux state hydration bridging server and client.

**Request flow (`src/server/server.js`):**
1. Express catches all GET routes with a single `app.get(/.*/, ...)` handler.
2. It manually matches the request path against `src/routes.js` using `path-to-regexp`'s `match()` (React Router itself never runs matching logic server-side for this purpose — it's duplicated here).
3. If the matched route's component has a static `fetchData(store)` method, it's awaited before rendering (see `About.fetchData` for the pattern — dispatch results into the Redux store, not returned directly).
4. The app renders via `renderToString` wrapped in `StaticRouter` + `Provider` + `Loading` context.
5. `context.url` (set by React Router on a `<Navigate>` during SSR) triggers a 301 redirect instead of returning HTML. `context.status === 404` sets the response status.
6. The full HTML shell (including an inline SVG "truck" loading animation, inlined as a string) is hand-built and returned; `window.__PRELOADED_STATE__` is injected via `serialize-javascript` (with `<` escaped) so the client can rehydrate Redux without refetching.
7. `/api/*` requests are proxied to `API_BASE_URL` via `http-proxy-middleware`.

**Client entry (`src/client/index.jsx`):** calls `hydrateRoot` (not `createRoot`) against `#root`, reading `window.__PRELOADED_STATE__` into `createStore` so client state matches what was server-rendered. Wrapped in `BrowserRouter` (vs. `StaticRouter` on the server) but otherwise mirrors the server's component tree (`Provider` → `Loading` → `App`) — keep these two trees structurally identical or hydration will mismatch.

**Routing (`src/routes.js` + `src/pages/App.jsx`):** routes are a flat array of `{ path, component, protected }`, consumed by both the server (for `fetchData` dispatch + path matching) and the client (`App.jsx` maps them to `<Route>` elements). To add a page: create the component under `src/pages/<name>/`, add an entry to the `routes` array. Set `protected: true` to wrap it in `PrivateRoute` (`src/client/PrivateRoute.jsx`), which redirects to `/auth/login` based on `state.data.auth.status`.

**State (`src/store/index.js`):** single Redux Toolkit slice (`data`) holds `items`, `about`, `auth`, `error`. `createStore(preloadedState)` is called fresh per-request on the server (avoids cross-request state leakage) and once on the client (seeded from `__PRELOADED_STATE__`). Auth status is a tri-state enum (`src/enums/auth.js`: `CHECKING` / `AUTHENTICATED` / `UNAUTHENTICATED`) — `PrivateRoute` renders `null` while `CHECKING` rather than immediately redirecting.

**API client (`src/service/api.js`):** axios instance pointed at `/api` (proxied by Express) with an interceptor that auto-retries once on a 401 by calling `/auth/refresh`, then dispatches `setAuthUnauthenticated` on failure. It reaches the Redux store via `src/store/storeRef.js`, a module-level mutable reference — this exists because axios interceptors can't use hooks; `setStore(store)` must be called (client-side) for this to work, though nothing currently calls it (see the `TODO` in that file before relying on 401-triggered logout behavior).

**Data fetching pattern:** page components that need server-rendered data export a static `fetchData(store)` async function (see `src/pages/about/About.jsx`) which the server invokes before render, dispatching into Redux. The component itself also fetches client-side in `useEffect` for subsequent client-only navigations, since SSR only runs on the initial full-page load. Both paths should dispatch to the same Redux actions.

**Build split:** `webpack.client.js` bundles for the browser (CSS extracted via `MiniCssExtractPlugin`, output `dist/client/bundle.js` + `styles.css`). `webpack.server.js` bundles for Node (`target: "node"`, deps externalized via `webpack-node-externals`, CSS imports stripped via `ignore-loader` since the server never renders styles — only the client needs them). Both share the same Babel config (`@babel/preset-env` + `@babel/preset-react`) and JSX/JS resolution.
