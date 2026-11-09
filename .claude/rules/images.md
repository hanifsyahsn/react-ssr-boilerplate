---
paths:
  - "src/**/*.{tsx,css}"
  - "public/**"
  - "src/assets/**"
---
# Fast image delivery (not implemented yet: reminder)

The boilerplate has no images yet (no `public/` folder; Express only serves `dist/client`). Before the first real images go in, set up the pipeline below, so content shows as fast as on big sites. Working reference: static site A in the local `derived-repos.md` (`src/images.ts`, `scripts/asset-manifest.js`, `usePhotoSwap` in `src/pages/product-detail/ProductDetail.tsx`, the `/v/*` rule in `src/server/prerender.tsx`).

Why it matters: an image swapped in on a click (a color picker, a gallery) is only downloaded at that moment, so it lags, for every visitor on every device; a CDN "warming up" doesn't fix it, and a browser cache only helps that one browser.

1. **Versioned URLs + long cache.** Hash every asset's content at build time into a manifest, serve it as `/v/<hash>/assets/...` with `Cache-Control: public, max-age=31536000, immutable` (Express: `app.use("/v/:version", express.static(publicDir, { immutable: true, maxAge: "1y" }))`). Replacing a file under the same name then shows up at once (new content, new hash, new URL). Never put a raw `/assets/...` path in `src`: always go through a helper (`assetUrl(path)`). Keep plain URLs only for things that must not change (link-preview image, favicon).
2. **Image CDN + `srcset`/`sizes`.** Serve each image resized to the screen (e.g. 320..original width) in WebP/AVIF instead of one big file for everyone. Options: Netlify Image CDN (`/.netlify/images?url=..&w=..`, Netlify only, off locally), Cloudinary / imgix / Cloudflare Images, or `sharp` behind the Express server with a cache. Read each image's pixel width into the manifest so the CDN is never asked for a copy wider than the original. A helper `imageSet(path, sizes)` returns `src`/`srcSet`/`sizes`.
3. **Prefetch what is likely next.** Hover/touch/focus on a card -> prefetch the photo its page opens with; on a page with variants, prefetch the other variants one by one once idle (`requestIdleCallback`, skip on data saver / 2G). Use `new Image()` with the **same** `sizes`/`srcset` as the `<img>`, or the browser picks a different copy and the prefetch is wasted; `await img.decode()` so it is paint-ready. In an SPA the next page's code is already in the bundle, so only its images need prefetching.
4. **Perception tricks.** Keep the current image up until the next one is decoded, then fade it in (never an empty/half-drawn frame); show a small loading indicator only if the wait passes ~150ms; only the latest pick wins on rapid switching; give the image box the photo's dominant color/background (or a blur placeholder) instead of white; `fetchpriority="high"` on the page's main image, `loading="lazy"` + `decoding="async"` below the fold, `width`/`height` on every `<img>` so nothing shifts.
5. **Measure.** Core Web Vitals (Search Console or host analytics) to see what is actually slow on real phones.
