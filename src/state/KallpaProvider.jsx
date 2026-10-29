import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { createEmptyProfile } from '../services/engine/profile.js';
import { buildDemoCase } from '../services/kallpaService.js';
import { clearState, loadState, saveState } from './storage.js';
import { KallpaContext } from './context.js';

/**
 * Estado global de KALLPA.
 *
 * - `profile`   → perfil de la persona (se guarda en este navegador)
 * - `diagnosis` → conversación en curso { session, ui }
 * - `cv`        → datos que la persona escribió para su CV { data, targetOccupationId, savedAt }
 *                 (en este navegador; con el backend también en PostgreSQL)
 * - `demo`      → modo demostración con su PROPIO perfil (María, ficticia);
 *                 nunca sobrescribe los datos de la persona.
 */
const persisted = typeof window !== 'undefined' ? loadState() : null;

const initialState = {
  profile: persisted?.profile || createEmptyProfile(),
  diagnosis: persisted?.diagnosis || null,
  cv: persisted?.cv || null,
  theme: persisted?.theme || 'system',
  explore: null, // ocupación seleccionada en la tabla comparativa (persona)
  demo: { active: false, step: 0, playing: false, data: null, profile: null, explore: null },
};

function reducer(state, action) {
  const inDemo = state.demo.active;
  const setProfile = (updater) => {
    if (inDemo) {
      const next = typeof updater === 'function' ? updater(state.demo.profile) : updater;
      return { ...state, demo: { ...state.demo, profile: next } };
    }
    const next = typeof updater === 'function' ? updater(state.profile) : updater;
    return { ...state, profile: { ...next, updatedAt: new Date().toISOString() } };
  };

  switch (action.type) {
    case 'diagnosis/set': {
      if (inDemo) return state;
      const { session, ui } = action;
      const profile = {
        ...session.profile,
        target: state.profile.target,
        routeProgress: state.profile.routeProgress,
        applications: state.profile.applications,
        updatedAt: new Date().toISOString(),
      };
      return { ...state, diagnosis: { session: { ...session, profile }, ui }, profile };
    }
    case 'diagnosis/reset':
      if (inDemo) return state;
      return { ...state, diagnosis: null, profile: createEmptyProfile(), explore: null };

    case 'profile/set':
      return setProfile(action.profile);

    case 'passport/store':
      return setProfile((p) => ({ ...p, passports: { ...p.passports, [action.passport.occupationId]: action.passport } }));

    case 'profile/target':
      // `job`: copia del puesto elegido desde su tarjeta (empleos del servidor que no
      // están en los catálogos locales). La ruta del servidor no la usa: lee PostgreSQL.
      return setProfile((p) => ({
        ...p,
        target: action.occupationId,
        targetSelected: Boolean(action.occupationId),
        targetJob: action.job ?? (p.targetJob?.id === action.occupationId ? p.targetJob : null),
      }));

    case 'application/add':
      // Postulación SIMULADA a un puesto del catálogo sintético (práctica dentro de KALLPA).
      return setProfile((p) => ({
        ...p,
        applications: {
          ...p.applications,
          [action.jobId]: { name: action.name, at: new Date().toISOString() },
        },
      }));

    case 'route/toggle':
      return setProfile((p) => {
        const occ = action.occupationId;
        const current = p.routeProgress?.[occ] || {};
        return {
          ...p,
          routeProgress: {
            ...p.routeProgress,
            [occ]: { ...current, [action.itemId]: !current[action.itemId] },
          },
        };
      });

    case 'route/setProgress':
      // Progreso que llega del servidor (ruta guardada en PostgreSQL).
      return setProfile((p) => ({
        ...p,
        routeProgress: { ...p.routeProgress, [action.occupationId]: action.progress },
      }));

    case 'cv/set':
      if (inDemo) return { ...state, demo: { ...state.demo, cv: action.cv } };
      return { ...state, cv: action.cv };

    case 'explore/select':
      if (inDemo) return { ...state, demo: { ...state.demo, explore: action.occupationId } };
      return { ...state, explore: action.occupationId };

    case 'theme/set':
      return { ...state, theme: action.theme };

    case 'all/reset':
      return {
        ...initialState,
        profile: createEmptyProfile(),
        diagnosis: null,
        cv: null,
        theme: state.theme,
        demo: initialState.demo,
      };

    case 'demo/start': {
      const data = action.data;
      return {
        ...state,
        demo: {
          active: true,
          step: 0,
          playing: true,
          data,
          profile: data.profile,
          explore: null,
          cv: null,
        },
      };
    }
    case 'demo/step':
      return { ...state, demo: { ...state.demo, step: action.step } };
    case 'demo/playing':
      return { ...state, demo: { ...state.demo, playing: action.playing } };
    case 'demo/exit':
      return { ...state, demo: initialState.demo };

    default:
      return state;
  }
}

export function KallpaProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Guardar en este navegador (nunca el modo demostración).
  useEffect(() => {
    saveState({
      profile: state.profile,
      diagnosis: state.diagnosis,
      cv: state.cv,
      theme: state.theme,
    });
  }, [state.profile, state.diagnosis, state.cv, state.theme]);

  // Aplicar tema
  useEffect(() => {
    const root = document.documentElement;
    if (state.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  const startDemo = useCallback(() => dispatch({ type: 'demo/start', data: buildDemoCase() }), []);
  const resetAll = useCallback(() => {
    clearState();
    dispatch({ type: 'all/reset' });
  }, []);

  const value = useMemo(() => {
    const isDemo = state.demo.active;
    return {
      state,
      dispatch,
      isDemo,
      profile: isDemo ? state.demo.profile : state.profile,
      explore: isDemo ? state.demo.explore : state.explore,
      cv: isDemo ? state.demo.cv : state.cv,
      startDemo,
      resetAll,
    };
  }, [state, startDemo, resetAll]);

  return <KallpaContext.Provider value={value}>{children}</KallpaContext.Provider>;
}
