import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { storeRef } from "../store/storeRef";
import { setAuthUnauthenticated } from "../store";

const api = axios.create({
    baseURL: "/api",
    withCredentials: true,
});

export default api;

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
}

api.interceptors.request.use((config) => config);

api.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
        const original = error.config as RetryableRequestConfig | undefined;
        const url = original?.url ?? "";

        if (url.includes("/auth/login") || url.includes("/auth/register") || url.includes("/auth/refresh")) {
            return Promise.reject(error);
        }

        if (error.response?.status === 401 && original && !original._retry) {
            original._retry = true;

            try {
                await api.post("/auth/refresh");
                return api(original);
            } catch (refreshError) {
                storeRef?.dispatch(setAuthUnauthenticated());
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);
