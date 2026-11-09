---
paths:
  - "src/store/**"
  - "src/service/**"
  - "src/client/**"
  - "src/pages/**"
  - "src/enums/**"
---
# Client state, auth and API

**State (`src/store/index.ts`):** one Redux Toolkit slice `data` with `items`, `about`, `auth`, `error`. `createStore(preloadedState)` is called per request on the server and once on the client (seeded from `__PRELOADED_STATE__`). Auth status is tri-state (`src/enums/auth.ts`): `CHECKING` / `AUTHENTICATED` / `UNAUTHENTICATED`; `PrivateRoute` renders `null` while CHECKING instead of redirecting.

**Auth flow:** cookie-only session (httpOnly `access_token` 15 min, `refresh_token` 7 days; the client never sees token values). `loginThunk` = login, then `me` for the user details; any failure → UNAUTHENTICATED + rejected with the API message. `logoutThunk` logs out locally even when the API call fails. `refreshSessionThunk` rotates both cookies (sliding session).

**API client (`src/service/api.ts`):** axios on `/api` with credentials. On a 401 it calls `/auth/refresh` once and retries the request; if the refresh fails it dispatches `setAuthUnauthenticated` through `storeRef` (axios can't use hooks; `src/client/index.tsx` calls `setStore`). 401s from `/auth/login`, `/auth/register`, `/auth/refresh` are never refreshed. `authApi.ts` turns JSON:API errors into `Error(detail || title)` with a per-call fallback message.

**Data fetching pattern:** a page needing server data defines static `fetchData(store)` (see `About.tsx`), run by the server before render, and also fetches in `useEffect` for client-side navigations. Both paths dispatch the same actions.

**Loading overlay:** `Loading` provides `useLoading()` (`undefined` outside the provider, so callers use `loadingCtx?.setLoading`).
