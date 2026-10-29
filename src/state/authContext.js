import { createContext, useContext } from 'react';

/** Contexto de la cuenta (ver AuthProvider.jsx). */
export const AuthContext = createContext(null);

/** Cuenta con sesión iniciada: { user, status, refresh, signIn, signUp, signOut, setUser }. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return ctx;
}
