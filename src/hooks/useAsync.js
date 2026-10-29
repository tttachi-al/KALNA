import { useEffect, useState } from 'react';

/**
 * Ejecuta una función asíncrona del servicio y expone { data, loading, error }.
 * Mantiene el último dato mientras recarga para evitar parpadeos.
 */
export function useAsync(fn, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(fn)
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => alive && setState((s) => ({ ...s, loading: false, error })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
