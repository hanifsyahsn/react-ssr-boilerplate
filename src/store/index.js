import { configureStore, createSlice } from '@reduxjs/toolkit'
import {AuthEnums} from "../enums/auth";

const dataSlice = createSlice({
    name: "data",
    initialState: {
        items: [],
        about: {},
        auth: {
            user: {},
            status: AuthEnums.CHECKING,
        },
        error: null,
    },
    reducers: {
        setAuthChecking: (state) => {
            state.auth.status = AuthEnums.CHECKING;
        },
        setAuthUser: (state, action) => {
            state.auth.user = action.payload.user;
            state.auth.status = AuthEnums.AUTHENTICATED;
        },
        setAuthUnauthenticated: (state) => {
            state.auth.user = {};
            state.auth.status = AuthEnums.UNAUTHENTICATED;
        },
        fetchAbout: (state, action) => {
            state.about = action.payload.about;
        },
        fetchError: (state, action) => {
            state.error = action.payload.error;
        },
    },
});

export const {
    fetchAbout,
    fetchError,
    setAuthChecking,
    setAuthUser,
    setAuthUnauthenticated,} = dataSlice.actions;

export const createStore = (preloadedState = {}) =>
    configureStore({
        reducer: {
            data: dataSlice.reducer,
        },
        preloadedState,
    })