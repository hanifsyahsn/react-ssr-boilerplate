import { configureStore, createSlice } from '@reduxjs/toolkit'

const dataSlice = createSlice({
    name: "data",
    initialState: {
        items: [],
        about: {},
        loading: false,
        error: null,
    },
    reducers: {
        fetchStart: (state) => {
            state.loading = true;
            state.error = null;
        },
        fetchSuccess: (state, action) => {
            state.loading = false;
            state.items = action.payload;
        },
        fetchAbout: (state, action) => {
            state.loading = false;
            state.about = action.payload.about;
        },
        fetchError: (state, action) => {
            state.loading = false;
            state.error = action.payload.error;
        },
    },
});

// Export action creators
export const {
    fetchStart,
    fetchSuccess,
    fetchAbout,
    fetchError
} = dataSlice.actions;

export const createStore = (preloadedState = {}) =>
    configureStore({
        reducer: {
            data: dataSlice.reducer,
        },
        preloadedState,
    })