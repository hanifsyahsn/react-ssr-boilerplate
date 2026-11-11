---
paths:
  - ".claude/rules/**"
  - "CLAUDE.md"
  - "package.json"
  - "webpack.*.js"
  - "postcss.config.js"
  - "src/server/**"
  - "src/client/**"
  - "src/service/**"
---
# Architecture decisions register

The binding decisions for this boilerplate **and every derived repo**. Refer to them by ID: the owner says e.g. "follow AD-11" in a derived repo. **Status** says whether the boilerplate itself has it yet. When it doesn't, the **reference** is the derived repo whose implementation to lift. The labels below (server app K, static site A...) map to repos in the local-only `derived-repos.md`, which is gitignored: this repo is public and the derived repos are partly internal.

**Scope:**
- **Global:** every repo.
- **Conditional:** every repo that meets the condition, and then it is binding, not a suggestion.
- **Optional:** take it when useful.

Repo types: **server apps** run Node in production (Docker on an internal server). **Static sites** are prerendered HTML on Netlify.

## Established (boilerplate has these)

| ID | Decision | Scope | Details |
|---|---|---|---|
| AD-01 | TypeScript 7 `strict`, `npm run typecheck`; webpack + Babel; `package-lock.json` committed, `npm ci` in CI | Global | `build.md` |
| AD-02 | Biome is the only linter; warnings fail | Global | `linting.md` |
| AD-03 | Behaviour-first tests (Vitest, RTL, MSW, supertest); coverage 95/95/95/90, never lowered; no real network | Global | `testing.md` |
| AD-04 | CI on every push/MR: lint → typecheck → test:coverage → build; `npm run check` runs the same | Global | `.github/workflows/ci.yml` |
| AD-05 | SSR server: `createApp(config)` holds the behaviour (`server.ts` only listens); fresh store per request; redirects 302, never 301 (except permanent URL aliases); decode the path before matching; state inlined with `serialize-javascript` | Global (server apps; static sites keep the render/redirect parts) | `ssr-server.md` |
| AD-06 | Short `CLAUDE.md` + one-topic `.claude/rules/*.md` with `paths:` | Global | `knowledge-as-rules.md` |
| AD-12 | `.env.example` committed with every key (no secrets); `.env` stays ignored | Global | `.env.example`, `.gitignore` |

## Decided 2026-11-10, AD-23 on 2026-11-11 (found in derived repos; boilerplate implementation pending)

| ID | Decision | Scope | Why | Reference |
|---|---|---|---|---|
| AD-10 | Client bundle and CSS get content-hashed names (`/_app/bundle.<hash>.js`), listed in `dist/client-assets.json` that the server reads; `/_app/*` cached a year `immutable`, HTML revalidated | Global | A fixed `bundle.js` lets a cached old bundle meet new HTML: hydration fails and every button stays dead until a refresh | static sites A, B: `webpack.client.js`, `render.tsx` |
| AD-11 | `#server-loader` lifts from an effect once hydration has **committed** (not a timer). The bundle is a `defer` script with `fetchpriority="high"`; a failing bundle reloads the page once (sessionStorage guard); taps before React is ready are replayed; the overlay fades by itself after 10s; loader CSS inline, not Tailwind | Global | The boilerplate's 2s `setTimeout` lifts too early (dead taps) or too late. Old cached HTML naming a gone bundle left pages dead | static site A: `src/server/render.tsx`, `src/client/index.tsx` (`LiftLoader`) |
| AD-13 | Versioning: `package.json` `version` is the only source, bumped in the same commit with `npm version x.y.z --no-git-tag-version`; commit titles `[<type>][<ticket>?][x.y.z] <summary>`; patch per change, minor per release (`[release][x.y.0] bump version`, annotated tag `vx.y.0`); version shown in the UI footer. Internal apps also keep a `LOGBOOK.md` | Global | Every repo invented a slightly different variant; one scheme keeps releases and support readable | static site P (release flow), server app M (`LOGBOOK.md`) |
| AD-14 | CSS for older browsers: PostCSS flattens nesting and media ranges (`postcss-nesting`, `postcss-media-minmax`); newer units (`cqi`, `svh`/`dvh`) get a plain fallback declaration first | Global | iOS < 16.5, Chrome < 112 and in-app WebViews drop nested rules and range queries (broke menus and carousels) | static site A: `postcss.config.js` |
| AD-15 | Graceful shutdown: handle SIGTERM/SIGINT, `server.close()`, close idle connections, force-close after 5s | Conditional: runs as a Node server in production | Node as PID 1 in Docker ignores SIGTERM, so deploys cut requests | server app K: `src/server/server.tsx` |
| AD-16 | One shared JSON:API module: deserialize (resolve `included`, safe for Redux), query builder (include/fields/sort/filter/page), serialize, typed errors (`JsonApiError` / `NetworkError` / `TimeoutError`); pages never hand-walk `included` | Conditional: talks to a JSON:API backend | Two server apps built two different versions of the same thing | server app K: `src/service/jsonApi/`; server app M: `src/service/jsonapi.ts` + `apiError.ts` (to be unified) |
| AD-17 | The `/api` proxy forwards only an allowlist of method + path, and credentials (API keys) are injected server-side only | Conditional: has an `/api` proxy | Proxying everything exposes every backend endpoint with the server's credentials | server app K: `src/server/apiAllowlist.ts` |
| AD-18 | Docker deploy: multi-stage `Dockerfile`, `build.sh` (image tagged with the `package.json` version), `deploy.sh` (SIGTERM with 30s timeout, then `docker compose up -d app`) | Conditional: deployed to an internal server | Same pattern already in two repos | server apps K, M |
| AD-19 | `BASE_PATH` (build-time, `webpack.shared.js` DefinePlugin) to serve the app under a sub-path | Conditional: served under a sub-path | Reverse-proxied internal deploys | server app K: `webpack.shared.js` |
| AD-20 | Static prerender mode (`build:static`): one `renderPage(url)` shared by dev server and prerender; writes `<page>.html`, `404.html`, `sitemap.xml`, `robots.txt`, `_redirects`, `_headers` | Conditional: deployed as static HTML | Three repos built this separately | static site A: `src/server/prerender.tsx` + `site.ts`; static site P: `src/server/static.ts` |
| AD-21 | SEO head per route: title, description, canonical, Open Graph/Twitter card, JSON-LD; 404 and non-200 get `noindex` only | Conditional: public site that should be indexed | Only `<title>` in the boilerplate | static site A: `src/seo.ts` |
| AD-22 | Fast image delivery: no raw `/assets/...` in `src`; `assetUrl`/`imageSet` give versioned `/v/<hash>/` URLs cached a year, CDN `srcset`, `width`/`height` on every `<img>`, prefetch | Conditional: serves its own images | Plan in `images.md` | static site A: `src/images.ts`, `scripts/asset-manifest.js` |
| AD-23 | Code review by a read-only reviewer: Antigravity (Opus 5.5, fallback Gemini 4 Argon high), or Claude Code `/code-review` in a fresh session when agy has no quota; the review lands only in `docs/review/REVIEW.md`; reports only a (bug in normal use), b (security), c (contract break, also binding Claude's own fixes) with scenario + exact code quote; one round per scope, round 2 only checks a/b/c fixes. **Safe for production** = no open a/b/c + lint/typecheck/test/build pass with behaviour tests (AD-03) + changed flow checked in a real browser | Global (c only where there is a backend contract; static sites: their CMS/API data source, else n/a) | A separate reviewer catches what the fixing context misses, and a fixed bar for "safe" stops endless review loops; the reviewer itself must be verified (it has cited non-existent files and missed a real bug) | server app M + backend M: `.agent/rules/code-review.md`, `docs/review/`; process and template in `code-review.md` |

## Optional

| ID | Idea | Reference |
|---|---|---|
| AD-30 | `?debug` overlay (user agent, hydration time, clicks, errors) for phones you can't test on | static site A: `render.tsx` |
| AD-31 | Test helpers `renderSite(url)`, `advance(ms)`, `setViewport()` | static site B: `src/test/helpers.tsx` |
| AD-32 | Theme without a flash: SSR theme from a cookie, or a boot script before paint | server app K (cookie), static site P (`themeBootScript`) |

**Changing this register:** add or change the row here, then add an item to every affected derived repo's `boilerplate-alignment.md` (see the local `derived-repos.md`). When the boilerplate implements a pending decision, move it to "Established" and point to the boilerplate file instead of the reference.
