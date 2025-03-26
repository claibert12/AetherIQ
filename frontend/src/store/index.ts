import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import analyticsReducer from './slices/analyticsSlice';
import workflowReducer from './slices/workflowSlice';
import complianceReducer from './slices/complianceSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    analytics: analyticsReducer,
    workflow: workflowReducer,
    compliance: complianceReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 