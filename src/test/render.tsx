import React, { type ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Provider } from "react-redux";
import { createStore, type AppStore, type DataState } from "../store";
import { AuthEnums } from "../enums/auth";
import { Loading } from "../components/loading";
import type { User } from "../types/auth";

export const TEST_USER: User = { id: "1", email: "demo@example.com", name: "Demo User" };

/** Store seeded like the server would seed it, with optional overrides. */
export function makeStore(data: Partial<DataState> = {}): AppStore {
    return createStore({
        data: {
            items: [],
            about: {},
            auth: { user: null, status: AuthEnums.UNAUTHENTICATED },
            error: null,
            ...data,
        },
    });
}

export const authenticated = { auth: { user: TEST_USER, status: AuthEnums.AUTHENTICATED } };
export const checking = { auth: { user: null, status: AuthEnums.CHECKING } };

/** Prints the current path so tests can assert where navigation ended up. */
function LocationProbe() {
    const location = useLocation();
    return <div data-testid="location">{location.pathname}</div>;
}

interface RenderOptions {
    store?: AppStore;
    route?: string;
    /** Wrap `ui` in a route at this path (needed for components using useParams etc.). */
    path?: string;
}

/** Renders `ui` inside the same providers as the real app (Router, Redux, Loading). */
export function renderWithProviders(ui: ReactElement, { store = makeStore(), route = "/", path }: RenderOptions = {}) {
    const result = render(
        <MemoryRouter initialEntries={[route]}>
            <Provider store={store}>
                <Loading>
                    {path ? (
                        <Routes>
                            <Route path={path} element={ui} />
                            <Route path="*" element={null} />
                        </Routes>
                    ) : (
                        ui
                    )}
                    <LocationProbe />
                </Loading>
            </Provider>
        </MemoryRouter>
    );
    return { ...result, store, location: () => result.getByTestId("location").textContent };
}
