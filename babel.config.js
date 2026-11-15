module.exports = {
    presets: [
        "@babel/preset-env",
        // Automatic JSX runtime, the same as tsconfig's "jsx": "react-jsx": files don't import React for JSX.
        // The classic default emits React.createElement and breaks every page with "React is not defined".
        ["@babel/preset-react", { runtime: "automatic" }],
        "@babel/preset-typescript",
    ]
}
