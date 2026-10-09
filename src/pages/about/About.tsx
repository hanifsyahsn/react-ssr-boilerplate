import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchAbout, fetchError } from "../../store";
import type { AppDispatch, AppStore, RootState } from "../../store";
import type { PageComponent } from "../../types/routing";

interface AboutData {
    title?: string;
    [key: string]: unknown;
}

const About: PageComponent = () => {
    const data = useSelector((state: RootState) => state.data.about) as AboutData;
    const dispatch = useDispatch<AppDispatch>();

    useEffect(() => {
        const getAbout = () => fetch("/api/todos/1").then((res) => res.json());

        getAbout()
            .then((result) => {
                dispatch(fetchAbout({ about: result }));
            })
            .catch((err) => {
                dispatch(fetchError({ error: err instanceof Error ? err.message : String(err) }));
            });
    }, [dispatch]);

    return (
        <div>
            <h1>About Page</h1>
            <p>{data.title}</p>
        </div>
    );
};

// Server-side data fetching function
About.fetchData = async (store: AppStore) => {
    const data = await fetch("https://jsonplaceholder.typicode.com/todos/1")
        .then((res) => res.json())
        .catch((err) => {
            store.dispatch(fetchError({ error: err instanceof Error ? err.message : String(err) }));
            return {};
        });
    store.dispatch(fetchAbout({ about: data }));
};

export default About;
