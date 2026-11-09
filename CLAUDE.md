# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test             # vitest run: all unit + integration tests (must pass before every commit)
npm run test:watch   # vitest in watch mode while developing
npm run test:coverage # tests + coverage report (coverage/index.html); fails below the thresholds in vitest.config.mts
npm run check        # typecheck + test:coverage — exactly what CI runs (plus build)
npx vitest run src/pages/login   # run one folder / file; add -t "name" to run one test
npm run dev          # dev server: rebuilds client+server bundles on change (watches src/, src/client) then runs dist/server/server.js
npm run devx         # same as dev but only watches src/ (no explicit src/client watch)
npm run build        # build:client + build:server (webpack, production or dev mode based on NODE_ENV)
npm run build:client # webpack.client.js -> dist/client/bundle.js + dist/client/styles.css
npm run build:server # webpack.server.js -> dist/server/server.js (bundled for node, deps externalized)
npm start            # NODE_ENV=production node dist/server/server.js (run build first)
```

No linter is configured.

There is no hot-reload dev server — `dev`/`devx` do a full rebuild-and-restart on every file change via nodemon, so changes take a few seconds to appear. The server exposes an SSE endpoint `/__livereload` that sends a build id (hash of the built bundles) and injects a small script into the HTML shell; when a restarted/redeployed server reports a different build id, open tabs react according to `LIVE_RELOAD`: `auto` (reload immediately — default in dev), `prompt` (show a "new version available" Refresh/Later banner — default in production), or `off` (no endpoint, no script).

`.env` sets `API_BASE_URL` (backend the `/api` requests are proxied to) and `LIVE_RELOAD` (`auto` | `prompt` | `off`). `PORT` defaults to 3000 if unset.

## Testing (mandatory)

Tests are required, not optional: CI (`.github/workflows/ci.yml`) runs typecheck, `test:coverage` and build on every push and PR, and fails when coverage drops below the thresholds in `vitest.config.mts` (95% lines/statements/functions, 90% branches). Repos started from this boilerplate keep this rule.

- **Every behaviour gets a test that asserts the outcome** (rendered text, store state, HTTP status/body/cookies, navigation), not one that only executes the code. Name tests after the behaviour in plain words (`"redirects an unauthenticated user to /auth/login"`) so a failure reads as the rule that broke. A new page, endpoint, reducer, thunk or edge case ships with its tests in the same change.
- **Coverage is supporting evidence, not the goal.** Never lower a threshold to make a change pass; add the missing behaviour test. When a change breaks existing tests, first report which behaviours broke and why, then change code or tests.
- Tests live next to the code as `*.test.ts(x)`. Default environment is jsdom; server tests start with `// @vitest-environment node`.
- **Stack:** Vitest, React Testing Library + `user-event` + jest-dom, MSW (fake backend for client code, `src/test/mswServer.ts`), supertest (real Express app).
- **Helpers (`src/test/`):** `renderWithProviders(ui, { store, route, path })` renders inside Router + Redux + Loading like the real app and returns `location()` to assert navigation; `makeStore()` / `authenticated` / `checking` seed state; `testApp(overrides)` builds the real Express app with no auth latency and live reload off; `preloadedState(html)` reads `window.__PRELOADED_STATE__` from SSR output; `useMswServer()` starts MSW for a file (unhandled requests fail the test); `fixtureRoutes.tsx` is a fake route table for testing the server's page contract.
- **Layers:** unit (reducers/thunks, `authApi`, axios 401-refresh interceptor, live reload config/script), component (pages, `PrivateRoute`, `Loading`), integration (`LoginPage` → thunk → axios → MSW; `App` with the real route table; `src/server/app.test.ts` SSR/auth/proxy/static via supertest; `src/client/index.test.tsx` hydrates real server HTML with the real client entry and fails on a hydration mismatch).
- Stub `fetch` (`vi.stubGlobal`) for anything that calls it (e.g. `About.fetchData`); tests must never hit the real network.

## Architecture

This is a hand-rolled (no framework like Next.js) React SSR boilerplate: one Express server does both SSR HTML rendering and serves the client bundle, with Redux state hydration bridging server and client.

**Request flow (`src/server/app.tsx`):** `server.tsx` is only the process entry (reads env, computes the build id, calls `createApp(config)`, listens). All behaviour lives in `createApp()` so tests can build the app with explicit config; live reload pieces are in `src/server/liveReload.ts`, the React render + HTML shell in `src/server/render.tsx`, the mock auth endpoints in `createAuthRouter(latencyMs)` (`src/server/authRoutes.ts`).
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

## Not yet implemented: fast image delivery (reminder)

The boilerplate has no images yet (no `public/` folder; Express only serves `dist/client`). Before the first real images go in, set up the pipeline below, so content shows as fast as on big sites. Working reference: static site A in the local `derived-repos.md` (`src/images.ts`, `scripts/asset-manifest.js`, `usePhotoSwap` in `src/pages/product-detail/ProductDetail.tsx`, the `/v/*` rule in `src/server/prerender.tsx`).

Why it matters: an image swapped in on a click (a color picker, a gallery) is only downloaded at that moment, so it lags, for every visitor on every device; a CDN "warming up" doesn't fix it, and a browser cache only helps that one browser.

1. **Versioned URLs + long cache.** Hash every asset's content at build time into a manifest, serve it as `/v/<hash>/assets/...` with `Cache-Control: public, max-age=31536000, immutable` (Express: `app.use("/v/:version", express.static(publicDir, { immutable: true, maxAge: "1y" }))`). Replacing a file under the same name then shows up at once (new content, new hash, new URL). Never put a raw `/assets/...` path in `src`: always go through a helper (`assetUrl(path)`). Keep plain URLs only for things that must not change (link-preview image, favicon).
2. **Image CDN + `srcset`/`sizes`.** Serve each image resized to the screen (e.g. 320..original width) in WebP/AVIF instead of one big file for everyone. Options: Netlify Image CDN (`/.netlify/images?url=..&w=..`, Netlify only, off locally), Cloudinary / imgix / Cloudflare Images, or `sharp` behind the Express server with a cache. Read each image's pixel width into the manifest so the CDN is never asked for a copy wider than the original. A helper `imageSet(path, sizes)` returns `src`/`srcSet`/`sizes`.
3. **Prefetch what is likely next.** Hover/touch/focus on a card -> prefetch the photo its page opens with; on a page with variants, prefetch the other variants one by one once idle (`requestIdleCallback`, skip on data saver / 2G). Use `new Image()` with the **same** `sizes`/`srcset` as the `<img>`, or the browser picks a different copy and the prefetch is wasted; `await img.decode()` so it is paint-ready. In an SPA the next page's code is already in the bundle, so only its images need prefetching.
4. **Perception tricks.** Keep the current image up until the next one is decoded, then fade it in (never an empty/half-drawn frame); show a small loading indicator only if the wait passes ~150ms; only the latest pick wins on rapid switching; give the image box the photo's dominant color/background (or a blur placeholder) instead of white; `fetchpriority="high"` on the page's main image, `loading="lazy"` + `decoding="async"` below the fold, `width`/`height` on every `<img>` so nothing shifts.
5. **Measure.** Core Web Vitals (Search Console or host analytics) to see what is actually slow on real phones.
