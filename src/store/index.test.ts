import { describe, expect, it, vi } from "vitest";
import * as authApi from "../service/authApi";
import {
    createStore,
    fetchAbout,
    fetchError,
    loginThunk,
    logoutThunk,
    refreshSessionThunk,
    setAuthChecking,
    setAuthUnauthenticated,
    setAuthUser,
} from "./index";
import { AuthEnums } from "../enums/auth";
import { TEST_USER, makeStore, authenticated } from "../test/render";

describe("store: initial state", () => {
    it("starts with auth CHECKING, no user, empty data and no error", () => {
        expect(createStore().getState().data).toEqual({
            items: [],
            about: {},
            auth: { user: null, status: AuthEnums.CHECKING },
            error: null,
        });
    });

    it("uses the preloaded state when given one (client hydration from the server)", () => {
        const store = makeStore({ about: { title: "from server" }, ...authenticated });
        expect(store.getState().data.about).toEqual({ title: "from server" });
        expect(store.getState().data.auth.user).toEqual(TEST_USER);
    });

    it("gives every createStore() call its own state, so server requests never share data", () => {
        const a = createStore();
        const b = createStore();
        a.dispatch(setAuthUser({ user: TEST_USER }));
        expect(b.getState().data.auth.status).toBe(AuthEnums.CHECKING);
    });
});

describe("store: reducers", () => {
    it("setAuthUser stores the user and marks the session AUTHENTICATED", () => {
        const store = createStore();
        store.dispatch(setAuthUser({ user: TEST_USER }));
        expect(store.getState().data.auth).toEqual({ user: TEST_USER, status: AuthEnums.AUTHENTICATED });
    });

    it("setAuthUnauthenticated clears the user and marks the session UNAUTHENTICATED", () => {
        const store = makeStore(authenticated);
        store.dispatch(setAuthUnauthenticated());
        expect(store.getState().data.auth).toEqual({ user: null, status: AuthEnums.UNAUTHENTICATED });
    });

    it("setAuthChecking puts the session back into CHECKING", () => {
        const store = makeStore();
        store.dispatch(setAuthChecking());
        expect(store.getState().data.auth.status).toBe(AuthEnums.CHECKING);
    });

    it("fetchAbout replaces the about data", () => {
        const store = makeStore({ about: { old: true } });
        store.dispatch(fetchAbout({ about: { title: "new" } }));
        expect(store.getState().data.about).toEqual({ title: "new" });
    });

    it("fetchError records the error message", () => {
        const store = createStore();
        store.dispatch(fetchError({ error: "boom" }));
        expect(store.getState().data.error).toBe("boom");
    });
});

describe("loginThunk", () => {
    it("logs in, loads the user from `me` and marks the session AUTHENTICATED", async () => {
        const login = vi.spyOn(authApi, "login").mockResolvedValue();
        vi.spyOn(authApi, "fetchMe").mockResolvedValue(TEST_USER);
        const store = createStore();

        const result = await store.dispatch(loginThunk({ email: "a@b.c", password: "pw" }));

        expect(login).toHaveBeenCalledWith({ email: "a@b.c", password: "pw" });
        expect(loginThunk.fulfilled.match(result)).toBe(true);
        expect(result.payload).toEqual(TEST_USER);
        expect(store.getState().data.auth).toEqual({ user: TEST_USER, status: AuthEnums.AUTHENTICATED });
    });

    it("rejects with the API error message and marks the session UNAUTHENTICATED when login fails", async () => {
        vi.spyOn(authApi, "login").mockRejectedValue(new Error("Invalid email or password"));
        const fetchMe = vi.spyOn(authApi, "fetchMe");
        const store = makeStore(authenticated);

        const result = await store.dispatch(loginThunk({ email: "x", password: "y" }));

        expect(loginThunk.rejected.match(result)).toBe(true);
        expect(result.payload).toBe("Invalid email or password");
        expect(fetchMe).not.toHaveBeenCalled();
        expect(store.getState().data.auth.status).toBe(AuthEnums.UNAUTHENTICATED);
    });

    it("rejects and stays logged out when the login succeeds but `me` fails", async () => {
        vi.spyOn(authApi, "login").mockResolvedValue();
        vi.spyOn(authApi, "fetchMe").mockRejectedValue(new Error("Failed to load current user"));
        const store = createStore();

        const result = await store.dispatch(loginThunk({ email: "x", password: "y" }));

        expect(result.payload).toBe("Failed to load current user");
        expect(store.getState().data.auth).toEqual({ user: null, status: AuthEnums.UNAUTHENTICATED });
    });

    it("falls back to 'Login failed' when the failure is not an Error", async () => {
        vi.spyOn(authApi, "login").mockRejectedValue("weird");
        const result = await createStore().dispatch(loginThunk({ email: "x", password: "y" }));
        expect(result.payload).toBe("Login failed");
    });
});

describe("logoutThunk", () => {
    it("calls the logout API and marks the session UNAUTHENTICATED", async () => {
        const logout = vi.spyOn(authApi, "logout").mockResolvedValue();
        const store = makeStore(authenticated);

        await store.dispatch(logoutThunk());

        expect(logout).toHaveBeenCalled();
        expect(store.getState().data.auth).toEqual({ user: null, status: AuthEnums.UNAUTHENTICATED });
    });

    it("still logs the user out locally when the logout API fails", async () => {
        vi.spyOn(authApi, "logout").mockRejectedValue(new Error("network down"));
        const store = makeStore(authenticated);

        const result = await store.dispatch(logoutThunk());

        expect(logoutThunk.fulfilled.match(result)).toBe(true);
        expect(store.getState().data.auth.status).toBe(AuthEnums.UNAUTHENTICATED);
    });
});

describe("refreshSessionThunk", () => {
    it("refreshes the session, reloads the user and marks the session AUTHENTICATED", async () => {
        const refresh = vi.spyOn(authApi, "refresh").mockResolvedValue();
        vi.spyOn(authApi, "fetchMe").mockResolvedValue(TEST_USER);
        const store = createStore();

        const result = await store.dispatch(refreshSessionThunk());

        expect(refresh).toHaveBeenCalled();
        expect(result.payload).toEqual(TEST_USER);
        expect(store.getState().data.auth).toEqual({ user: TEST_USER, status: AuthEnums.AUTHENTICATED });
    });

    it("rejects and logs the user out when the refresh fails", async () => {
        vi.spyOn(authApi, "refresh").mockRejectedValue(new Error("Missing or expired refresh token"));
        const store = makeStore(authenticated);

        const result = await store.dispatch(refreshSessionThunk());

        expect(refreshSessionThunk.rejected.match(result)).toBe(true);
        expect(result.payload).toBe("Missing or expired refresh token");
        expect(store.getState().data.auth.status).toBe(AuthEnums.UNAUTHENTICATED);
    });

    it("falls back to 'Session refresh failed' when the failure is not an Error", async () => {
        vi.spyOn(authApi, "refresh").mockRejectedValue(undefined);
        const result = await createStore().dispatch(refreshSessionThunk());
        expect(result.payload).toBe("Session refresh failed");
    });
});
