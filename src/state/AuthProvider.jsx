import { useCallback, useEffect, useMemo, useState } from 'react';
import { kallpaService } from '../services/kallpaService.js';
import { AuthContext } from './authContext.js';

/**
 * Sesión de la cuenta. El servidor es la única fuente de verdad: la sesión es
 * una cookie HttpOnly que el navegador no puede leer, así que al cargar se
 * pregunta a GET /auth/me. Sin servidor, la cuenta queda como no iniciada.
 *
 * status: 'loading' | 'ready' | 'unavailable'
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  const refresh = useCallback(async () => {
    try {
      const r = await kallpaService.getAccount();
      setUser(r.user || null);
      setStatus('ready');
      return r.user || null;
    } catch {
      setUser(null);
      setStatus('unavailable');
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = useCallback(async (body) => {
    const r = await kallpaService.login(body);
    setUser(r.user);
    setStatus('ready');
    return r.user;
  }, []);

  const signUp = useCallback(async (body) => {
    const r = await kallpaService.register(body);
    setUser(r.user);
    setStatus('ready');
    return r.user;
  }, []);

  const signOut = useCallback(async () => {
    await kallpaService.logout();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, status, refresh, signIn, signUp, signOut, setUser }), [user, status, refresh, signIn, signUp, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
