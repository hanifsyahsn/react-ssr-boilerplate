import { configureStore, createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { AuthEnums } from "../enums/auth";
import * as authApi from "../service/authApi";
import type { Credentials } from "../service/authApi";
import type { User } from "../types/auth";

interface AuthState {
    user: User | null;
    status: (typeof AuthEnums)[keyof typeof AuthEnums];
}

export interface DataState {
    items: unknown[];
    about: Record<string, unknown>;
    auth: AuthState;
    error: string | null;
}

const initialState: DataState = {
    items: [],
    about: {},
    auth: {
        user: null,
        status: AuthEnums.CHECKING,
    },
    error: null,
};

const dataSlice = createSlice({
    name: "data",
    initialState,
    reducers: {
        setAuthChecking: (state) => {
            state.auth.status = AuthEnums.CHECKING;
        },
        setAuthUser: (state, action: PayloadAction<{ user: User }>) => {
            state.auth.user = action.payload.user;
            state.auth.status = AuthEnums.AUTHENTICATED;
        },
        setAuthUnauthenticated: (state) => {
            state.auth.user = null;
            state.auth.status = AuthEnums.UNAUTHENTICATED;
        },
        fetchAbout: (state, action: PayloadAction<{ about: Record<string, unknown> }>) => {
            state.about = action.payload.about;
        },
        fetchError: (state, action: PayloadAction<{ error: string }>) => {
            state.error = action.payload.error;
        },
    },
});

export const {
    fetchAbout,
    fetchError,
    setAuthChecking,
    setAuthUser,
    setAuthUnauthenticated,
} = dataSlice.actions;

function errorMessage(err: unknown, fallback: string): string {
    return err instanceof Error ? err.message : fallback;
}

// Login only confirms the session cookie was set - user details always come
// from a separate `me` call, matching how a real cookie-auth backend works.
export const loginThunk = createAsyncThunk<User, Credentials, { rejectValue: string }>(
    "auth/login",
    async (credentials, { dispatch, rejectWithValue }) => {
        try {
            await authApi.login(credentials);
            const user = await authApi.fetchMe();
            dispatch(setAuthUser({ user }));
            return user;
        } catch (err) {
            dispatch(setAuthUnauthenticated());
            return rejectWithValue(errorMessage(err, "Login failed"));
        }
    }
);

export const logoutThunk = createAsyncThunk("auth/logout", async (_: void, { dispatch }) => {
    await authApi.logout().catch(() => undefined);
    dispatch(setAuthUnauthenticated());
});

// Sliding refresh: every call rotates both the access and refresh cookies
// on the backend, so an active session's expiry keeps pushing forward.
export const refreshSessionThunk = createAsyncThunk<User, void, { rejectValue: string }>(
    "auth/refresh",
    async (_arg, { dispatch, rejectWithValue }) => {
        try {
            await authApi.refresh();
            const user = await authApi.fetchMe();
            dispatch(setAuthUser({ user }));
            return user;
        } catch (err) {
            dispatch(setAuthUnauthenticated());
            return rejectWithValue(errorMessage(err, "Session refresh failed"));
        }
    }
);

export type PreloadedRootState = { data: DataState };

export const createStore = (preloadedState?: PreloadedRootState) =>
    configureStore({
        reducer: {
            data: dataSlice.reducer,
        },
        preloadedState,
    });

export type AppStore = ReturnType<typeof createStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
