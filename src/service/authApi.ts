import axios from "axios";
import api from "./api";
import type { JsonApiDataResponse, JsonApiErrorResponse, User, UserAttributes } from "../types/auth";

export interface Credentials {
    email: string;
    password: string;
}

function toErrorMessage(err: unknown, fallback: string): string {
    if (axios.isAxiosError<JsonApiErrorResponse>(err)) {
        const apiError = err.response?.data?.errors?.[0];
        if (apiError) {
            return apiError.detail || apiError.title;
        }
    }
    return fallback;
}

export async function login(credentials: Credentials): Promise<void> {
    try {
        await api.post("/auth/login", credentials);
    } catch (err) {
        throw new Error(toErrorMessage(err, "Failed to log in"));
    }
}

export async function fetchMe(): Promise<User> {
    try {
        const { data } = await api.get<JsonApiDataResponse<UserAttributes>>("/auth/me");
        return { id: data.data.id, ...data.data.attributes };
    } catch (err) {
        throw new Error(toErrorMessage(err, "Failed to load current user"));
    }
}

export async function refresh(): Promise<void> {
    try {
        await api.post("/auth/refresh");
    } catch (err) {
        throw new Error(toErrorMessage(err, "Failed to refresh session"));
    }
}

export async function logout(): Promise<void> {
    try {
        await api.post("/auth/logout");
    } catch (err) {
        throw new Error(toErrorMessage(err, "Failed to log out"));
    }
}
