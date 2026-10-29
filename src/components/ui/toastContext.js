import { createContext, useContext } from 'react';

export const ToastContext = createContext({ show: () => {} });
export const useToast = () => useContext(ToastContext);
