import type { ComponentType } from "react";
import type { AppStore } from "../store";

export type PageComponent = ComponentType<{ context?: RouteContext }> & {
    fetchData?: (store: AppStore) => Promise<void>;
};

export interface RouteContext {
    url?: string;
    status?: number;
}

export interface AppRoute {
    path: string;
    component: PageComponent;
    protected?: boolean;
}
