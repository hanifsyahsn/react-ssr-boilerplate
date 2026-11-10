---
paths:
  - "src/**"
  - "vitest.config.mts"
---
# Testing (mandatory)

CI (`.github/workflows/ci.yml`) runs typecheck, `test:coverage` and build on every push and PR, and fails below the thresholds in `vitest.config.mts` (95% lines/statements/functions, 90% branches). Repos started from this boilerplate keep this rule.

- **Every behaviour gets a test that asserts the outcome** (rendered text, store state, HTTP status/body/cookies, navigation), not one that only executes the code. Name tests after the behaviour in plain words (`"redirects an unauthenticated user to /auth/login"`) so a failure reads as the rule that broke. A new page, endpoint, reducer, thunk or edge case ships with its tests in the same change.
- **Coverage is supporting evidence, not the goal.** Never lower a threshold to make a change pass; add the missing behaviour test. When a change breaks existing tests, first report which behaviours broke and why, then change code or tests.
- Check that a new test can fail: break the code it guards once and see it go red.
- Tests live next to the code as `*.test.ts(x)`. Default environment is jsdom; server tests start with `// @vitest-environment node`.
- Tests must never hit the real network: client HTTP goes through MSW (unhandled requests fail), `fetch` callers (e.g. `About.fetchData`) get `vi.stubGlobal("fetch", ...)`.

**Stack:** Vitest, React Testing Library + `user-event` + jest-dom, MSW, supertest.

**Helpers (`src/test/`):**
- `renderWithProviders(ui, { store, route, path })`: renders inside Router + Redux + Loading like the real app; returns `location()` to assert navigation.
- `makeStore()`, `authenticated`, `checking`, `TEST_USER`: seed state.
- `setupMswServer()`, `server`, `API`, `apiError()` (`mswServer.ts`): fake backend mirroring the mock auth contract.
- `testApp(overrides)`: the real Express app (`createApp`) with no auth latency and live reload off; `preloadedState(html)` reads the state out of SSR HTML.
- `fixtureRoutes.tsx`: fake route table, swapped in with `vi.mock("../routes", () => import("../test/fixtureRoutes"))` to test the server's page contract.

**Layers:**
- Unit: reducers/thunks, `authApi`, axios 401-refresh interceptor, live reload config/script/endpoint.
- Component: pages, `PrivateRoute`, `Loading`.
- Integration: `LoginPage` → thunk → axios → MSW; `App` with the real route table; `src/server/app*.test.ts` (SSR, auth, redirects, proxy, static, via supertest); `src/client/index.test.tsx` hydrates real server HTML with the real client entry and fails on a hydration mismatch (checks the server's DOM nodes survive, since React 19 reports mismatches via `reportError`, not `console.error`).
