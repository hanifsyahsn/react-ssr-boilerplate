// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// @babel/core ships no types and @types/babel__core isn't worth a dependency for one call
const { transformSync } = createRequire(import.meta.url)("@babel/core") as {
    transformSync: (code: string, options: Record<string, string>) => { code?: string | null } | null;
};
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Vitest compiles JSX with its own transform, so the other tests can't see how webpack's Babel compiles it. Source
// files don't import React (tsconfig "jsx": "react-jsx"), so the build must use the automatic runtime too.
describe("webpack's Babel config", () => {
    it("compiles JSX without needing React in scope, so built pages don't throw 'React is not defined'", () => {
        const root = path.resolve(__dirname, "../..");
        const out = transformSync('export const Hello = () => <p className="x">hi</p>;', {
            cwd: root,
            filename: path.join(root, "src/Hello.tsx"),
            configFile: path.join(root, "babel.config.js"),
        })?.code;

        expect(out).toContain("react/jsx-runtime");
        expect(out).not.toContain("React.createElement");
    });
});
