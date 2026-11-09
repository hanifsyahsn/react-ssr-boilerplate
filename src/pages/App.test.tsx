import React from "react";
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { AuthEnums } from "../enums/auth";
import { authenticated, makeStore, renderWithProviders } from "../test/render";
import { useMswServer } from "../test/mswServer";
import type { RouteContext } from "../types/routing";

// Integration: the real route table rendered through App (nav + routing + auth).
useMswServer();

// About fetches on mount; keep it from hitting the network in routing tests.
function stubAboutFetch() {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ title: "todo" }) })));
}

describe("App navigation bar", () => {
    it("shows Home, About and a Login link to a logged-out visitor", () => {
        renderWithProviders(<App />);
        const nav = screen.getByRole("navigation");
        expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
        expect(within(nav).getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
        expect(within(nav).getByRole("link", { name: "Login" })).toHaveAttribute("href", "/auth/login");
        expect(within(nav).queryByRole("button", { name: "Logout" })).not.toBeInTheDocument();
    });

    it("greets a logged-in user by name and offers Logout instead of Login", () => {
        renderWithProviders(<App />, { store: makeStore(authenticated) });
        const nav = screen.getByRole("navigation");
        expect(nav).toHaveTextContent("Hi, Demo User");
        expect(within(nav).getByRole("button", { name: "Logout" })).toBeInTheDocument();
        expect(within(nav).queryByRole("link", { name: "Login" })).not.toBeInTheDocument();
    });

    it("logs the user out and sends them to the login page when Logout is clicked", async () => {
        const { store, location } = renderWithProviders(<App />, { store: makeStore(authenticated) });

        await userEvent.setup().click(screen.getByRole("button", { name: "Logout" }));

        await waitFor(() => expect(location()).toBe("/auth/login"));
        expect(store.getState().data.auth.status).toBe(AuthEnums.UNAUTHENTICATED);
        expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
    });

    it("navigates between pages client-side when nav links are clicked", async () => {
        stubAboutFetch();
        const user = userEvent.setup();
        const { location } = renderWithProviders(<App />);

        await user.click(screen.getByRole("link", { name: "About" }));
        expect(location()).toBe("/about");
        expect(screen.getByRole("heading", { name: "About Page" })).toBeInTheDocument();

        await user.click(screen.getByRole("link", { name: "Home" }));
        expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
    });
});

describe("App routing", () => {
    it.each([
        ["/", "Home"],
        ["/auth/login", "Login"],
        ["/about", "About Page"],
        ["/does/not/exist", "404 - Page Not Found"],
    ])("renders the page registered for %s", (route, heading) => {
        stubAboutFetch();
        renderWithProviders(<App />, { route });
        expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    });

    it("passes the route context to pages so the server learns about a 404", () => {
        const context: RouteContext = {};
        renderWithProviders(<App context={context} />, { route: "/nope" });
        expect(context.status).toBe(404);
    });
});
