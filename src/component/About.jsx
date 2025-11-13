import React, {useEffect} from "react";
import {useDispatch, useSelector} from "react-redux";
import {fetchAbout, fetchError} from "../store/index";

// Component
const About = () => {
    const data = useSelector((state) => state.data.about);
    const dispatch = useDispatch();

    useEffect(() => {
        const getAbout = () => {
            return fetch("/api/todos/1")
                .then((res) => res.json());
        };

        getAbout()
            .then((result) => {
                dispatch(fetchAbout({ about: result }));
            })
            .catch((err) => {
                dispatch(fetchError({ error: err.message || err }));
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
About.fetchData = async (store) => {
    // Simulate API call
    const data = await fetch("https://jsonplaceholder.typicode.com/todos/1")
        .then(res => res.json())
        .catch(err => {
            const message = err.response?.data?.message || err;
            store.dispatch(fetchError({ error: message }));
        });
    // Dispatch to populate Redux
    store.dispatch(fetchAbout({ about: data }));
};

export default About;
