import React from 'react'
import {hydrateRoot} from "react-dom/client";
import App from "../pages/App"
import {BrowserRouter} from "react-router-dom";
import {Provider} from "react-redux";
import {createStore} from "../store/index"
import {Loading} from "../components/loading";
import "../styles/global.css"

const store = createStore(window.__PRELOADED_STATE__);

hydrateRoot(document.getElementById("root"),
    <BrowserRouter>
        <Provider store={store}>
            <Loading>
                <App/>
            </Loading>
        </Provider>
    </BrowserRouter>)

// DEBUG THE INITIAL LOADDER FOR 2 SECONDS
setTimeout(() => {
    const loader = document.getElementById("server-loader");
    if (loader) loader.style.display = "none";
}, 2000);