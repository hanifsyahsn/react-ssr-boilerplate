import Home from "./component/Home";
import About from "./component/About";
import NotFound from "./component/NotFound";

export const routes = [
    { path: "/", component: Home },
    { path: "/about", component: About },
    { path: "*", component: NotFound },
];
