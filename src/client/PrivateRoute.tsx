import React, { type ReactNode } from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { AuthEnums } from "../enums/auth";
import type { RootState } from "../store";

interface PrivateRouteProps {
    children: ReactNode;
}

function PrivateRoute({ children }: PrivateRouteProps) {
    const auth = useSelector((state: RootState) => state.data.auth);

    if (auth.status === AuthEnums.CHECKING) {
        return null;
    }

    if (auth.status === AuthEnums.UNAUTHENTICATED) {
        return <Navigate to="/auth/login" replace />;
    }

    return <>{children}</>;
}

export default PrivateRoute;
