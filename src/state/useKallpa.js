import { useContext } from 'react';
import { KallpaContext } from './context.js';

/** Acceso al estado global de KALLPA. */
export function useKallpa() {
  const ctx = useContext(KallpaContext);
  if (!ctx) throw new Error('useKallpa debe usarse dentro de <KallpaProvider>.');
  return ctx;
}
