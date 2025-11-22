import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import { routes } from "../routes";
import PrivateRoute from "../client/PrivateRoute";

const App = ({context}) => {
    return (
        <div>
            <nav>
                <Link to="/">Home</Link> | <Link to="/about">About</Link>
            </nav>
            <Routes>
                {routes.map(({path, component: Component, protected: isProtected}) => (
                    <Route
                        key={path}
                        path={path}
                        element={
                            isProtected ? (
                                <PrivateRoute>
                                    <Component context={context} />
                                </PrivateRoute>
                            ) : (
                                <Component context={context} />
                            )
                        }
                    />
                ))}
            </Routes>
        </div>
    );
};

export default App;