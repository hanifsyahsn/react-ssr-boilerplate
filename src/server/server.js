import path from "path";
import express from "express";
import React from "react";
import { renderToString } from "react-dom/server";
import App from "../component/App";
import {StaticRouter} from "react-router-dom/server";
import {Provider} from "react-redux";
import { createStore } from "../store/index";
import serialize from 'serialize-javascript'
import cookieParser from "cookie-parser";
import { routes } from "../routes";
import { match as pathMatch } from "path-to-regexp";
import {createProxyMiddleware} from "http-proxy-middleware";

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.static(path.resolve(__dirname, "../../dist/client")));

app.use(cookieParser());

app.use(
    "/api",
    createProxyMiddleware({
        target: "https://jsonplaceholder.typicode.com",
        changeOrigin: true,
        pathRewrite: { "^/api": "" }, // optional, remove /api prefix when hitting backend
    })
);

app.get(/.*/, async (req, res) => {
    try {
        const store = createStore();
        const context = {}

        const matchedRoute =
            routes.find(r => r.path !== "*" && pathMatch(r.path, { decode: decodeURIComponent })(req.path))
            || routes.find(r => r.path === "*");

        if (matchedRoute?.component?.fetchData) {
            await matchedRoute.component.fetchData(store);
        }

        const appHtml = renderToString(
            <StaticRouter location={req.url} context={context}>
                <Provider store={store}>
                    <App context={context} />
                </Provider>
            </StaticRouter>
        )

        const status = context.status || 200;

        if (context.url) {
            return res.redirect(301, context.url)
        }

        if (status === 404) {
            res.status(status);
        }

        const html = `
    <!DOCTYPE html>
    <html>
        <head><title>${status === 404 ? '404 Not Found' : 'SSR React Router'}</title></head>
        <body>
            <div id="root">${appHtml}</div>
            <script>
                window.__PRELOADED_STATE__ = ${serialize(store.getState()).replace(
            /</g,
            "\\u003c"
        )};
            </script>
            <script src="/bundle.js"></script>
        </body>
    </html>
  `;
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
