import React from 'react'
import {hydrateRoot} from "react-dom/client";
import App from "../component/App"
import {BrowserRouter} from "react-router-dom";
import {Provider} from "react-redux";
import {createStore} from "../store/index"

const store = createStore(window.__PRELOADED_STATE__);

hydrateRoot(document.getElementById("root"),
    <BrowserRouter>
        <Provider store={store}>
            <App/>
        </Provider>
    </BrowserRouter>)