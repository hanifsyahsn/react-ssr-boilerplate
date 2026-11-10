# CLAUDE.md

Hand-rolled React SSR boilerplate (no Next.js): one Express server renders the HTML (React 19 + React Router v6 + Redux Toolkit) and serves the client bundle; Redux state goes from server to client through `window.__PRELOADED_STATE__`. TypeScript, built with webpack + Babel.

Detailed knowledge lives in `.claude/rules/` and loads only when you touch the matching files (see the index below). Keep this file short.

## Commands

```bash
npm test              # all unit + integration tests (must pass before every commit)
npm run test:watch    # watch mode
npm run test:coverage # tests + coverage (coverage/index.html); fails below the thresholds in vitest.config.mts
npm run lint          # Biome linter; warnings fail (lint:fix applies safe fixes)
npm run check         # lint + typecheck + test:coverage, which is what CI runs (plus build)
npx vitest run src/pages/login     # one folder/file; add -t "name" for one test
npm run dev           # rebuild client+server on change (nodemon) and run dist/server/server.js
npm run build         # webpack client + server bundles into dist/
npm start             # production server (run build first)
```

`.env` (copy `.env.example`, never commit `.env`): `API_BASE_URL` (where `/api/*` is proxied), `LIVE_RELOAD` (`auto` | `prompt` | `off`), `PORT` (default 3000).

## Always

- **Tests are mandatory.** Every behaviour change ships with behaviour tests in the same change, and CI enforces coverage thresholds. Details: `.claude/rules/testing.md`.
- **Knowledge goes into rules, not this file.** See `.claude/rules/knowledge-as-rules.md`.

## Rules index (`.claude/rules/`)

| File | Loads when touching | About |
|---|---|---|
| `knowledge-as-rules.md` | always | how to store project knowledge without wasting context |
| `testing.md` | `src/**`, `vitest.config.mts` | test policy, stack, helpers, layers |
| `ssr-server.md` | `src/server/**`, `src/routes.ts`, `src/client/index.tsx`, `src/pages/App.tsx`, `src/types/routing.ts` | request flow, routing, redirects, live reload, hydration |
| `client-state-api.md` | `src/store/**`, `src/service/**`, `src/client/**`, `src/pages/**`, `src/enums/**` | Redux state, auth, API client, data fetching pattern |
| `build.md` | `webpack.*.js`, `babel.config.js`, `postcss.config.js`, `tsconfig.json`, `package.json` | bundle split and toolchain |
| `linting.md` | `src/**`, `biome.json`, `package.json`, CI workflow | Biome linter: decision (why not ESLint), rules, suppressions |
| `architecture-decisions.md` | rules, configs, `src/{server,client,service}/**` | register of binding decisions AD-xx (global / conditional / optional), status and reference implementation |
| `derived-repos.md` | rules, configs, CI, `src/server/**` | **local only (gitignored)**: derived repos, reference labels, how to propagate a change |
| `images.md` | `src/**/*.{tsx,css}`, `public/**`, `src/assets/**` | fast image delivery plan (not implemented yet) |
