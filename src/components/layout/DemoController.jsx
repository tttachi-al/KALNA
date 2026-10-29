import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DEMO_STEPS } from '../../data/demoSteps.js';
import { useKallpa } from '../../state/useKallpa.js';

/**
 * Sincroniza el Modo demostración con la navegación:
 * en cada paso abre la pantalla correspondiente y aplica lo que el paso destaca.
 * Si la persona navega por su cuenta, la reproducción automática se pausa.
 */
export function DemoController() {
  const { state, dispatch } = useKallpa();
  const navigate = useNavigate();
  const location = useLocation();
  const expected = useRef(null);
  const navRef = useRef(navigate);
  const { active, step, playing } = state.demo;

  // useNavigate cambia en cada navegación: lo guardamos en una ref para que
  // el efecto de pasos solo se ejecute cuando cambia el paso.
  useEffect(() => {
    navRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    if (!active) {
      expected.current = null;
      return;
    }
    const s = DEMO_STEPS[step];
    if (!s) return;
    if (s.explore) dispatch({ type: 'explore/select', occupationId: s.explore });
    if (s.target) {
      dispatch({ type: 'profile/target', occupationId: s.target });
      dispatch({ type: 'explore/select', occupationId: s.target });
    }
    expected.current = s.route;
    navRef.current(s.route);
  }, [active, step, dispatch]);

  useEffect(() => {
    if (!active || !playing || !expected.current) return;
    if (location.pathname !== expected.current) dispatch({ type: 'demo/playing', playing: false });
  }, [location.pathname, active, playing, dispatch]);

  return null;
}
