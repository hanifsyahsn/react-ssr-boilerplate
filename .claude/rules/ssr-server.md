---
paths:
  - "src/server/**"
  - "src/routes.ts"
  - "src/client/index.tsx"
  - "src/pages/App.tsx"
  - "src/types/routing.ts"
---
# SSR server and routing

**Files:** `server.tsx` is only the process entry (reads env, computes the build id, calls `createApp(config)`, listens). All behaviour is in `createApp()` (`app.tsx`) so tests build the app with explicit config. Live reload: `liveReload.ts`. React render + HTML shell: `render.tsx`. Mock auth endpoints: `createAuthRouter(latencyMs)` in `authRoutes.ts` (dummy backend from `mockAuth.ts`; swap it for a real API later).

**Request flow (`app.get(/.*/)`):**
1. Fresh `createStore()` per request (no state leaks between users); auth resolved from the `access_token` cookie, so the first render is AUTHENTICATED or UNAUTHENTICATED, never CHECKING.
2. Route matched with `path-to-regexp` against `src/routes.ts` (duplicated from React Router). The path is `decodeURI`d first so the server picks the same route as the client for encoded URLs; a malformed escape is matched raw.
3. `protected: true` route + no user → **302** to `/auth/login` before rendering. Always 302, never 301: browsers cache 301 forever and would keep bouncing the user after login.
4. Matched component's static `fetchData(store)` is awaited (dispatch into the store, don't return data).
5. `renderToString` in `StaticRouter` → `Provider` → `Loading` → `App context`.
6. A page may set `context.url` (→ 302 redirect) or `context.status = 404` (→ 404 + "404 Not Found" title). Note: `<Navigate>` does not set `context.url` in React Router v6.
7. HTML shell from `htmlDocument()`; state inlined with `serialize-javascript` and `<` escaped. Any thrown error → 500 "Internal Server Error".
8. `/api/auth/*` is handled by the mock router; everything else under `/api` is proxied to `API_BASE_URL` without the `/api` prefix.

**Routing:** `src/routes.ts` is a flat `{ path, component, protected }` array used by the server and by `App.tsx`. Add a page: component in `src/pages/<name>/`, entry in `routes`, tests for it. `protected: true` wraps it in `PrivateRoute` on the client and redirects on the server.

**Hydration:** `src/client/index.tsx` calls `hydrateRoot` with `BrowserRouter` → `Provider` → `Loading` → `App`, mirroring `renderAppHtml`. Keep the two trees identical or hydration mismatches (caught by `src/client/index.test.tsx`). The client hides `#server-loader` after a temporary 2s debug delay.

**Live reload:** `/__livereload` SSE sends `retry` (500ms dev / 5s prod) and the build id (hash of the built bundles), pings every 30s. The injected script reacts to a new build id per `LIVE_RELOAD`: `auto` reloads (default dev), `prompt` shows a Refresh/Later banner (default prod), `off` = no endpoint and no script. Unknown values fall back to the default with a warning.
