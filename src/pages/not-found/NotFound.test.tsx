import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound from "./NotFound";
import type { RouteContext } from "../../types/routing";

describe("NotFound page", () => {
    it("shows a 404 message", () => {
        render(<NotFound />);
        expect(screen.getByRole("heading", { name: "404 - Page Not Found" })).toBeInTheDocument();
    });

    it("tells the server to respond with HTTP 404 via the route context", () => {
        const context: RouteContext = {};
        render(<NotFound context={context} />);
        expect(context.status).toBe(404);
    });
});
