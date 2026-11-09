import React from "react";
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import LoginPage from "./LoginPage";
import { AuthEnums } from "../../enums/auth";
import { API, server, useMswServer } from "../../test/mswServer";
import { TEST_USER, renderWithProviders } from "../../test/render";

// Integration: LoginPage -> loginThunk -> authApi -> axios -> (fake) backend.
useMswServer();

async function submit(email: string, password: string) {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), email);
    await user.type(screen.getByLabelText("Password"), password);
    await user.click(screen.getByRole("button", { name: "Log in" }));
}

describe("Login page", () => {
    it("shows the form with the demo credentials hint and no error", () => {
        renderWithProviders(<LoginPage />, { route: "/auth/login" });
        expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
        expect(screen.getByText(/demo@example.com \/ password123/)).toBeInTheDocument();
        expect(screen.getByLabelText("Email")).toBeRequired();
        expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("logs in with valid credentials, stores the user and goes to the home page", async () => {
        const { store, location } = renderWithProviders(<LoginPage />, { route: "/auth/login" });

        await submit("demo@example.com", "password123");

        await waitFor(() => expect(location()).toBe("/"));
        expect(store.getState().data.auth).toEqual({ user: TEST_USER, status: AuthEnums.AUTHENTICATED });
    });

    it("shows the API error and stays on the login page with wrong credentials", async () => {
        const { store, location } = renderWithProviders(<LoginPage />, { route: "/auth/login" });

        await submit("demo@example.com", "wrong");

        expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
        expect(location()).toBe("/auth/login");
        expect(store.getState().data.auth.status).toBe(AuthEnums.UNAUTHENTICATED);
    });

    it("shows the loading overlay while the login request is in flight, then hides it", async () => {
        server.use(
            http.post(`${API}/auth/login`, async () => {
                await delay(50);
                return new HttpResponse(null, { status: 200 });
            })
        );
        const { location } = renderWithProviders(<LoginPage />, { route: "/auth/login" });

        await submit("demo@example.com", "password123");

        expect(await screen.findByRole("status")).toHaveTextContent("Loading…");
        await waitFor(() => expect(location()).toBe("/"));
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("clears the previous error when the user tries again", async () => {
        server.use(
            http.post(`${API}/auth/login`, async ({ request }) => {
                const body = (await request.json()) as { password: string };
                if (body.password === "wrong") {
                    return HttpResponse.json({ errors: [{ status: "401", title: "Unauthorized", detail: "Invalid email or password" }] }, { status: 401 });
                }
                await delay(50);
                return new HttpResponse(null, { status: 200 });
            })
        );
        renderWithProviders(<LoginPage />, { route: "/auth/login" });
        await submit("demo@example.com", "wrong");
        expect(await screen.findByRole("alert")).toBeInTheDocument();

        const user = userEvent.setup();
        await user.clear(screen.getByLabelText("Password"));
        await user.type(screen.getByLabelText("Password"), "password123");
        await user.click(screen.getByRole("button", { name: "Log in" }));

        await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    });
});
