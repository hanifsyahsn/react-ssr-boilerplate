import axios from "axios";
import { storeRef } from "../store/storeRef";
import {setAuthUnauthenticated} from "../store";

const api = axios.create({
    baseURL: "/api",
    withCredentials: true,
})

export default api

api.interceptors.request.use((config) => {
    return config;
});

api.interceptors.response.use(
    (res) => res,
    async (error) => {
        const original = error.config;
        const url = original.url;

        if (
            url.includes("/auth/login") ||
            url.includes("/auth/register") ||
            url.includes("/auth/refresh")
        ) {
            return Promise.reject(error);
        }

        if (error.response?.status === 401 && !original._retry) {
            original._retry = true;

            try {
                await api.post("/auth/refresh");

                return api(original);
            } catch (refreshError) {
                if (storeRef) {
                    storeRef.dispatch(setAuthUnauthenticated());
                }
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);