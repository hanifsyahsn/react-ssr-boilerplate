// webpack.client.js
const path = require("path");

const isDev = process.env.NODE_ENV !== "production";

module.exports = {
    mode: isDev ? "development" : "production",
    entry: "./src/client/index.jsx",
    output: {
        path: path.resolve(__dirname, "dist/client"),
        filename: "bundle.js",
    },
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                use: "babel-loader",
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"],
            },
        ],
    },
    resolve: {
        extensions: [".js", ".jsx"],
    },
    devtool: isDev ? "cheap-module-source-map" : false, // source maps only in dev
};