---
paths:
  - "src/**"
  - "biome.json"
  - "package.json"
  - ".github/workflows/**"
---
# Linting (Biome) — architecture decision

**Decision (2026-11-10):** lint with [Biome](https://biomejs.dev) (`@biomejs/biome`, pinned exact), config in `biome.json`. Lint only: formatter and assist (import sorting) are off.

**Why Biome, not ESLint:**
- We use TypeScript 7 (native compiler). `typescript-eslint` 8.x peers on `typescript <6.1`, so ESLint+TS would need forced installs and type-aware rules can break. Biome has its own parser and does not depend on the TS compiler.
- One dependency, no plugin graph to keep in sync; ~50 ms for the whole repo.
- Covers what we need: React domain (rules of hooks, exhaustive deps, components defined inside functions), a11y, unused imports/vars, `node:` protocol, `import type`, and Tailwind v4 directives in CSS.
- Trade-off accepted: fewer niche plugins than ESLint, and no React Compiler lint rules. Revisit if typescript-eslint supports TS 7 and we need a rule Biome lacks.

**Rules:**
- `recommended` preset + `react` and `test` domains. Test files and `src/test/**` may use `!` and `any`.
- CI and `npm run check` run `npm run lint` (`--error-on-warnings`): warnings fail the build, so fix or suppress, never leave them.
- Suppress a false positive inline with a reason: `// biome-ignore lint/<group>/<rule>: <why>` (example: the `void` thunk arg in `src/store/index.ts`).
- Functions named `useXxx` are treated as React hooks. Don't use that prefix for non-hook helpers (that's why the MSW helper is `setupMswServer`).
- `npm run lint:fix` applies safe fixes only. Unsafe fixes (`--unsafe`, e.g. removing unused imports) can leave a blank first line: review the diff.
- `biome migrate` in 2.6 turned `"recommended": true` into `"preset": "none"`. After any migrate, check that the preset is still `recommended`.
