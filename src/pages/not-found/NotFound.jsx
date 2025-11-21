import React from 'react'

function NotFound({ context }) {
    if (context) context.status = 404;
    return (
        <h1>404 - Page Not Found</h1>
    )
}

export default NotFound;