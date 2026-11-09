import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, setAuthUser } from "../store";
import { renderAppHtml } from "../server/render";
import { AuthEnums } from "../enums/auth";
import { TEST_USER } from "../test/render";
import { http } from "msw";
import { API, apiError, server, useMswServer } from "../test/mswServer";
import type { RouteContext } from "../types/routing";

// Integration: HTML rendered by the server tree is hydrated by the real client
// entry. Catches the two trees drifting apart (hydration mismatch).
useMswServer();

/** Puts server-rendered HTML + preloaded state into the page, like the HTML shell does. */
function serverRender(url: string, loggedIn = false) {
    const store = createStore();
    if (loggedIn) store.dispatch(setAuthUser({ user: TEST_USER }));
    const context: RouteContext = {};
    document.body.innerHTML = `<div id="server-loader"></div><div id="root">${renderAppHtml(url, store, context)}</div>`;
    window.__PRELOADED_STATE__ = store.getState();
    window.history.pushState({}, "", url);
}

async function bootClient() {
    await act(async () => {
        await import("./index");
    });
    const { storeRef } = await import("../store/storeRef");
    return storeRef!;
}

describe("client entry (hydration)", () => {
    let consoleError: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.resetModules();
        consoleError = vi.spyOn(console, "error");
    });
    afterEach(() => {
        document.body.innerHTML = "";
        delete window.__PRELOADED_STATE__;
        vi.useRealTimers();
    });

    it.each([
        ["/", false],
        ["/", true],
        ["/auth/login", false],
        ["/not-a-page", false],
    ])("hydrates the server HTML for %s (logged in: %s) without a mismatch", async (url, loggedIn) => {
        serverRender(url, loggedIn);
        // Hydration adopts the server's DOM nodes; on a mismatch React throws
        // them away and client-renders new ones (and reports a recoverable error).
        const serverNodes = Array.from(document.querySelectorAll("#root *"));
        const reported: unknown[] = [];
        const onError = (e: ErrorEvent) => reported.push(e.error ?? e.message);
        window.addEventListener("error", onError);

        try {
            await bootClient();
        } finally {
            window.removeEventListener("error", onError);
        }

        expect(serverNodes.length).toBeGreaterThan(0);
        expect(serverNodes.every((node) => node.isConnected)).toBe(true);
        expect(reported).toEqual([]);
        expect(consoleError.mock.calls.filter((args: unknown[]) => /hydrat/i.test(args.map(String).join(" ")))).toEqual([]);
    });

    it("seeds the client store from window.__PRELOADED_STATE__ instead of refetching", async () => {
        serverRender("/", true);
        const store = await bootClient();
        expect(store.getState().data.auth).toEqual({ user: TEST_USER, status: AuthEnums.AUTHENTICATED });
    });

    it("registers the store for the API client, so a failed session refresh logs the user out", async () => {
        server.use(
            http.get(`${API}/things`, () => apiError(401, "expired")),
            http.post(`${API}/auth/refresh`, () => apiError(401, "Missing or expired refresh token"))
        );
        serverRender("/", true);
        const store = await bootClient();
        const { default: api } = await import("../service/api");

        await act(async () => {
            await api.get("/things").catch(() => undefined);
        });

        expect(store.getState().data.auth.status).toBe(AuthEnums.UNAUTHENTICATED);
        expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument();
    });

    it("is interactive after hydration (client-side navigation works)", async () => {
        serverRender("/");
        await bootClient();
        await userEvent.setup().click(screen.getByRole("link", { name: "Login" }));
        expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
    });

    it("hides the server loader 2 seconds after start (temporary debug delay)", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout"] });
        serverRender("/");
        await bootClient();
        const loader = document.getElementById("server-loader")!;

        vi.advanceTimersByTime(1999);
        expect(loader.style.display).toBe("");
        vi.advanceTimersByTime(1);
        expect(loader.style.display).toBe("none");
    });

    it("does not crash if the server loader is not on the page", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout"] });
        serverRender("/");
        document.getElementById("server-loader")!.remove();
        await bootClient();
        expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
    });
});
