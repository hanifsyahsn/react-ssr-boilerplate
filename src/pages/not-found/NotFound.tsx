import React from "react";
import type { RouteContext } from "../../types/routing";

interface NotFoundProps {
    context?: RouteContext;
}

function NotFound({ context }: NotFoundProps) {
    if (context) context.status = 404;
    return <h1>404 - Page Not Found</h1>;
}

export default NotFound;
