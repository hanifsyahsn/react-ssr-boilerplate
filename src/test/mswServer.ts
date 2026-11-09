import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";
import type { JsonApiErrorResponse } from "../types/auth";
import { TEST_USER } from "./render";

// Fake backend for client-side tests, mirroring the contract of the mock auth
// router in src/server/authRoutes.ts (JSON:API bodies, cookie-only session).
export const API = "http://localhost:3000/api";

export const apiError = (status: number, detail: string, title = "Unauthorized") =>
    HttpResponse.json<JsonApiErrorResponse>({ errors: [{ status: String(status), title, detail }] }, { status });

export const meResponse = () =>
    HttpResponse.json({
        data: { type: "users", id: TEST_USER.id, attributes: { email: TEST_USER.email, name: TEST_USER.name } },
    });

export const defaultHandlers = [
    http.post(`${API}/auth/login`, async ({ request }) => {
        const body = (await request.json()) as { email?: string; password?: string };
        if (body.email === "demo@example.com" && body.password === "password123") {
            return new HttpResponse(null, { status: 200 });
        }
        return apiError(401, "Invalid email or password");
    }),
    http.get(`${API}/auth/me`, () => meResponse()),
    http.post(`${API}/auth/refresh`, () => new HttpResponse(null, { status: 200 })),
    http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 200 })),
];

export const server = setupServer(...defaultHandlers);

/** Call at the top level of a test file that talks to the API. */
export function useMswServer() {
    beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
    afterEach(() => server.resetHandlers());
    afterAll(() => server.close());
}
