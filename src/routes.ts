import Home from "./pages/home/Home";
import About from "./pages/about/About";
import NotFound from "./pages/not-found/NotFound";
import LoginPage from "./pages/login/LoginPage";
import type { AppRoute } from "./types/routing";

export const routes: AppRoute[] = [
    { path: "/", component: Home },
    { path: "/auth/login", component: LoginPage },
    { path: "/about", component: About },
    { path: "*", component: NotFound },
];
