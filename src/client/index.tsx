import React from "react";
import { hydrateRoot } from "react-dom/client";
import App from "../pages/App";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { createStore, type PreloadedRootState } from "../store/index";
import { setStore } from "../store/storeRef";
import { Loading } from "../components/loading";
import "../styles/global.css";

declare global {
    interface Window {
        __PRELOADED_STATE__?: PreloadedRootState;
    }
}

const store = createStore(window.__PRELOADED_STATE__);
setStore(store);

hydrateRoot(
    document.getElementById("root") as HTMLElement,
    <BrowserRouter>
        <Provider store={store}>
            <Loading>
                <App />
            </Loading>
        </Provider>
    </BrowserRouter>
);

// DEBUG THE INITIAL LOADDER FOR 2 SECONDS
setTimeout(() => {
    const loader = document.getElementById("server-loader");
    if (loader) loader.style.display = "none";
}, 2000);
