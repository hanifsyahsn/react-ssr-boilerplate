import React from "react";
import { fetchAbout } from "../store";
import type { AppRoute, PageComponent, RouteContext } from "../types/routing";

// Purpose-built route table for testing the server's page contract
// (src/server/app.routes.test.ts swaps it in for src/routes.ts).

const Moved: PageComponent = ({ context }: { context?: RouteContext }) => {
    if (context) context.url = "/new-home";
    return null;
};

const Crash: PageComponent = () => {
    throw new Error("render exploded");
};

const BrokenData: PageComponent = () => <p>never</p>;
BrokenData.fetchData = async () => {
    throw new Error("fetchData exploded");
};

const Secret: PageComponent = () => <p>secret page</p>;
const Fallback: PageComponent = () => <p>fallback</p>;

// Records that the server ran fetchData, so tests can tell which route matched.
const Cafe: PageComponent = () => <p>cafe page</p>;
Cafe.fetchData = async (store) => {
    store.dispatch(fetchAbout({ about: { matched: "café" } }));
};

export const routes: AppRoute[] = [
    { path: "/moved", component: Moved },
    { path: "/crash", component: Crash },
    { path: "/broken-data", component: BrokenData },
    { path: "/secret", component: Secret, protected: true },
    { path: "/café", component: Cafe },
    { path: "*", component: Fallback },
];
