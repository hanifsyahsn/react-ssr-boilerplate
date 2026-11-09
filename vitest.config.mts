import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        // Browser-like by default (components, store, API client). Server tests
        // opt into Node with a `// @vitest-environment node` comment at the top.
        environment: "jsdom",
        setupFiles: ["./src/test/setup.ts"],
        include: ["src/**/*.test.{ts,tsx}"],
        restoreMocks: true,
        unstubGlobals: true,
        coverage: {
            provider: "v8",
            include: ["src/**/*.{ts,tsx}"],
            exclude: [
                "src/**/*.test.{ts,tsx}",
                "src/test/**",
                "src/types/**",
                // Process entry point: only reads env vars and calls listen().
                // Everything it wires up is covered through createApp().
                "src/server/server.tsx",
            ],
            reporter: ["text", "html", "lcov"],
            // CI fails when coverage drops below these. Raise them, never lower
            // them to make a change pass: add the missing behaviour test instead.
            thresholds: {
                lines: 95,
                statements: 95,
                functions: 95,
                branches: 90,
            },
        },
    },
});
