import type { AppStore } from "./index";

export let storeRef: AppStore | null = null;

export function setStore(store: AppStore): void {
    storeRef = store;
}
