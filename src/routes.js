import Home from "./pages/home/Home";
import About from "./pages/about/About";
import NotFound from "./pages/not-found/NotFound";

export const routes = [
    { path: "/", component: Home },
    { path: "/about", component: About },
    { path: "*", component: NotFound },
];

// export const routes = [
//     { path: "/auth", component: AuthPage },
//
//     { path: "/supplier/home", component: HomePage, protected: true },
//     { path: "/about", component: AboutPage, protected: true },
//
//     { path: "*", component: NotFoundPage },
// ];
