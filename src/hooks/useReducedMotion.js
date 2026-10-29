import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';
const ATTR = 'data-a11y-motion';

/** true si el sistema pide menos movimiento o si se activó «Detener animaciones». */
function isReduced() {
  if (typeof window === 'undefined') return false;
  const system = window.matchMedia ? window.matchMedia(QUERY).matches : false;
  return system || document.documentElement.getAttribute(ATTR) === 'reduce';
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(isReduced);
  useEffect(() => {
    const on = () => setReduced(isReduced());
    const mq = window.matchMedia?.(QUERY);
    mq?.addEventListener?.('change', on);
    const mo = new MutationObserver(on);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: [ATTR] });
    return () => {
      mq?.removeEventListener?.('change', on);
      mo.disconnect();
    };
  }, []);
  return reduced;
}
