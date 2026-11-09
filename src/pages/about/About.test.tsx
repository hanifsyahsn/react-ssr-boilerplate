import React from "react";
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import About from "./About";
import { createStore } from "../../store";
import { makeStore, renderWithProviders } from "../../test/render";

function stubFetch(impl: () => Promise<unknown>) {
    const fetchMock = vi.fn(impl);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

const jsonResponse = (body: unknown) => Promise.resolve({ json: () => Promise.resolve(body) });

describe("About page (client)", () => {
    it("shows the server-rendered title immediately, before any client fetch resolves", () => {
        stubFetch(() => new Promise(() => {}));
        renderWithProviders(<About />, { store: makeStore({ about: { title: "from SSR" } }) });
        expect(screen.getByRole("heading", { name: "About Page" })).toBeInTheDocument();
        expect(screen.getByText("from SSR")).toBeInTheDocument();
    });

    it("fetches /api/todos/1 on mount and shows the result (client-side navigation)", async () => {
        const fetchMock = stubFetch(() => jsonResponse({ title: "fresh title" }));
        const { store } = renderWithProviders(<About />);

        expect(await screen.findByText("fresh title")).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith("/api/todos/1");
        expect(store.getState().data.about).toEqual({ title: "fresh title" });
    });

    it("records the error in the store when the client fetch fails", async () => {
        stubFetch(() => Promise.reject(new Error("offline")));
        const { store } = renderWithProviders(<About />);
        await waitFor(() => expect(store.getState().data.error).toBe("offline"));
    });

    it("records non-Error failures as text", async () => {
        stubFetch(() => Promise.reject("bad gateway"));
        const { store } = renderWithProviders(<About />);
        await waitFor(() => expect(store.getState().data.error).toBe("bad gateway"));
    });
});

describe("About.fetchData (server)", () => {
    it("loads the todo from the API into the store before render", async () => {
        const fetchMock = stubFetch(() => jsonResponse({ title: "server todo" }));
        const store = createStore();

        await About.fetchData!(store);

        expect(fetchMock).toHaveBeenCalledWith("https://jsonplaceholder.typicode.com/todos/1");
        expect(store.getState().data.about).toEqual({ title: "server todo" });
        expect(store.getState().data.error).toBeNull();
    });

    it("records the error and still renders with empty data when the API is down", async () => {
        stubFetch(() => Promise.reject(new Error("ECONNREFUSED")));
        const store = createStore();

        await expect(About.fetchData!(store)).resolves.toBeUndefined();

        expect(store.getState().data.error).toBe("ECONNREFUSED");
        expect(store.getState().data.about).toEqual({});
    });

    it("records non-Error failures as text", async () => {
        stubFetch(() => Promise.reject(503));
        const store = createStore();
        await About.fetchData!(store);
        expect(store.getState().data.error).toBe("503");
    });
});
