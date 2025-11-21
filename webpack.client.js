// webpack.client.js
const path = require("path");
const MiniCssExtractPlugin  = require("mini-css-extract-plugin");

const isDev = process.env.NODE_ENV !== "production";

module.exports = {
    mode: isDev ? "development" : "production",
    entry: "./src/client/index.jsx",
    output: {
        path: path.resolve(__dirname, "dist/client"),
        filename: "bundle.js",
        publicPath: "/",
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
                use: [
                    MiniCssExtractPlugin.loader,
                    "css-loader",
                    "postcss-loader",
                ],
            },
        ],
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: "styles.css",
        }),
    ],
    resolve: {
        extensions: [".js", ".jsx"],
    },
    devtool: isDev ? "cheap-module-source-map" : false, // source maps only in dev
};