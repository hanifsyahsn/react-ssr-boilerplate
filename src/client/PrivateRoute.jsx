import React from 'react'
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import {AuthEnums} from "../enums/auth";

function PrivateRoute({ children }) {
    const auth = useSelector((state) => state.data.auth);

    if (auth.status === AuthEnums.CHECKING) {
        return null;
    }

    if (auth.status === AuthEnums.UNAUTHENTICATED) {
        return <Navigate to="/auth" replace />;
    }

    return children;
}

export default PrivateRoute;
