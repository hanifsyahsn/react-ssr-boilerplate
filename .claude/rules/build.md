---
paths:
  - "webpack.*.js"
  - "babel.config.js"
  - "postcss.config.js"
  - "tsconfig.json"
  - "package.json"
---
# Build

- `webpack.client.js`: browser bundle `dist/client/bundle.js` + extracted CSS `styles.css` (MiniCssExtractPlugin, PostCSS with Tailwind v4).
- `webpack.server.js`: Node bundle `dist/server/server.js` (`target: "node"`, deps externalized with `webpack-node-externals`, CSS imports dropped with `ignore-loader`).
- Both use Babel (`preset-env`, `preset-react`, `preset-typescript`); `tsc --noEmit` (`npm run typecheck`) does type checking only.
- No hot reload: `npm run dev` rebuilds and restarts on every change (nodemon); open tabs refresh via live reload.
- Tests use Vitest's own transform (`vitest.config.mts`), not webpack/Babel.
- `package-lock.json` is committed and CI uses `npm ci`: commit lockfile changes together with `package.json` changes.
