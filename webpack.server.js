// webpack.server.js
const path = require("path");
const nodeExternals = require("webpack-node-externals");

const isDev = process.env.NODE_ENV !== "production";

module.exports = {
    mode: isDev ? "development" : "production",
    target: "node",
    externals: [nodeExternals()],
    entry: "./src/server/server.tsx",
    output: {
        path: path.resolve(__dirname, "dist/server"),
        filename: "server.js",
    },
    module: {
        rules: [
            {
                test: /\.[jt]sx?$/,
                exclude: /node_modules/,
                use: "babel-loader",
            },
            {
                test: /\.css$/,
                loader: "ignore-loader",
            }
        ],
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js", ".jsx"],
    },
    devtool: isDev ? "inline-source-map" : false,
};
