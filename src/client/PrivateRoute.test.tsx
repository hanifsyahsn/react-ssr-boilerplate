import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import PrivateRoute from "./PrivateRoute";
import { authenticated, checking, makeStore, renderWithProviders } from "../test/render";

const guarded = (
    <PrivateRoute>
        <p>secret content</p>
    </PrivateRoute>
);

describe("PrivateRoute", () => {
    it("shows the protected page to an authenticated user", () => {
        const { location } = renderWithProviders(guarded, { store: makeStore(authenticated), route: "/secret" });
        expect(screen.getByText("secret content")).toBeInTheDocument();
        expect(location()).toBe("/secret");
    });

    it("redirects an unauthenticated user to /auth/login", () => {
        const { location } = renderWithProviders(guarded, { route: "/secret", path: "/secret" });
        expect(screen.queryByText("secret content")).not.toBeInTheDocument();
        expect(location()).toBe("/auth/login");
    });

    it("renders nothing and does not redirect while auth is still CHECKING", () => {
        const { location } = renderWithProviders(guarded, { store: makeStore(checking), route: "/secret" });
        expect(screen.queryByText("secret content")).not.toBeInTheDocument();
        expect(location()).toBe("/secret");
    });
});
