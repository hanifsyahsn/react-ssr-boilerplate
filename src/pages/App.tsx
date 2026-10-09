import React from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { routes } from "../routes";
import PrivateRoute from "../client/PrivateRoute";
import { logoutThunk } from "../store";
import { AuthEnums } from "../enums/auth";
import type { AppDispatch, RootState } from "../store";
import type { RouteContext } from "../types/routing";

interface AppProps {
    context?: RouteContext;
}

const App = ({ context }: AppProps) => {
    const auth = useSelector((state: RootState) => state.data.auth);
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await dispatch(logoutThunk());
        navigate("/auth/login");
    };

    return (
        <div>
            <nav>
                <Link to="/">Home</Link> | <Link to="/about">About</Link>
                {" | "}
                {auth.status === AuthEnums.AUTHENTICATED ? (
                    <>
                        Hi, {auth.user?.name}{" "}
                        <button type="button" onClick={handleLogout}>
                            Logout
                        </button>
                    </>
                ) : (
                    <Link to="/auth/login">Login</Link>
                )}
            </nav>
            <Routes>
                {routes.map(({ path, component: Component, protected: isProtected }) => (
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
