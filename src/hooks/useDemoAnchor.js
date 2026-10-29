import { useEffect } from 'react';
import { DEMO_STEPS } from '../data/demoSteps.js';
import { useKallpa } from '../state/useKallpa.js';

/**
 * En el modo demostración y en pantallas pequeñas, desplaza la vista hasta
 * el elemento que el paso actual quiere mostrar.
 * @param {Record<string, React.RefObject>} anchors  { idDelPaso: ref }
 */
export function useDemoAnchor(anchors) {
  const { state, isDemo } = useKallpa();
  const stepId = DEMO_STEPS[state.demo.step]?.id;

  useEffect(() => {
    if (!isDemo || !stepId) return undefined;
    const ref = anchors[stepId];
    if (!ref) return undefined;
    const small = window.matchMedia?.('(max-width: 1023px)').matches;
    if (!small) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Espera a que la pantalla termine de cargar sus datos antes de desplazar
    const t = setTimeout(() => ref.current?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, stepId]);
}
