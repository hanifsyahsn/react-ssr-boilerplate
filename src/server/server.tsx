import path from "node:path";
import dotenv from "dotenv";
import { createApp } from "./app";
import { computeBuildId, resolveLiveReloadMode } from "./liveReload";

// Process entry point: reads the environment and starts listening. All
// behaviour lives in createApp() (src/server/app.tsx) so tests can build an
// app with explicit config instead of a real port and real env vars.
dotenv.config();

const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== "production";

const { mode: liveReloadMode, warning } = resolveLiveReloadMode(process.env.LIVE_RELOAD, isDev);
if (warning) console.warn(warning);

const app = createApp({
    isDev,
    apiBaseUrl: process.env.API_BASE_URL as string,
    clientDir: path.resolve(__dirname, "../../dist/client"),
    liveReloadMode,
    buildId: computeBuildId([
        path.resolve(__dirname, "../../dist/client/bundle.js"),
        path.resolve(__dirname, "../../dist/client/styles.css"),
        path.resolve(__dirname, "../../dist/server/server.js"),
    ]),
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
