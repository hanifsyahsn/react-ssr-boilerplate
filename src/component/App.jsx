import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import { routes } from "../routes";

const App = ({context}) => {
    return (
        <div>
            <nav>
                <Link to="/">Home</Link> | <Link to="/about">About</Link>
            </nav>
            <Routes>
                {routes.map(({path, component: Component}) => (
                    <Route key={path} path={path} element={<Component context={context} />} />
                ))}
            </Routes>
        </div>
    );
};

export default App;