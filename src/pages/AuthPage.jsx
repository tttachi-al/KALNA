import { CircleAlert, LoaderCircle, LogIn, UserPlus } from 'lucide-react';
import { useId, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useToast } from '../components/ui/toastContext.js';
import { useAuth } from '../state/authContext.js';
import { useKallpa } from '../state/useKallpa.js';
import './account.css';

const COPY = {
  login: {
    eyebrow: 'Tu cuenta',
    title: 'Iniciar sesión',
    lead: 'Entra con tu correo y contraseña para guardar tu perfil en tu cuenta y gestionarla.',
    submit: 'Iniciar sesión',
    busy: 'Entrando…',
    other: { text: '¿Todavía no tienes cuenta?', to: '/crear-cuenta', label: 'Crear cuenta' },
  },
  register: {
    eyebrow: 'Tu cuenta',
    title: 'Crear cuenta',
    lead: 'Con una cuenta, tu perfil de competencias queda asociado a ti y puedes eliminarlo cuando quieras.',
    submit: 'Crear cuenta',
    busy: 'Creando tu cuenta…',
    other: { text: '¿Ya tienes cuenta?', to: '/iniciar-sesion', label: 'Iniciar sesión' },
  },
};

/** Formulario único para iniciar sesión y crear cuenta (`mode`). */
export default function AuthPage({ mode }) {
  const copy = COPY[mode];
  const { user, signIn, signUp } = useAuth();
  const { profile, isDemo } = useKallpa();
  const navigate = useNavigate();
  const toast = useToast();
  const id = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (user) return <Navigate to="/cuenta" replace />;

  const register = mode === 'register';
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (register && password !== repeat) return setError('Las contraseñas no coinciden.');
    setBusy(true);
    try {
      // El perfil de este navegador se vincula a la cuenta (nunca el de la demostración).
      const body = { email, password, profileId: !isDemo ? profile?.profileId : undefined };
      await (register ? signUp(body) : signIn(body));
      toast.show(register ? 'Tu cuenta se creó y la sesión está iniciada.' : 'Sesión iniciada.');
      navigate('/cuenta', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page account">
      <header className="page-header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="lead">{copy.lead}</p>
        </div>
      </header>
      <form className="card stack account-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor={`${id}-email`}>Correo electrónico</label>
          <input id={`${id}-email`} className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-pass`}>Contraseña</label>
          <input id={`${id}-pass`} className="input" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby={register ? `${id}-pass-h` : undefined} />
          {register && <p className="field-help" id={`${id}-pass-h`}>Al menos 8 caracteres.</p>}
        </div>
        {register && (
          <div className="field">
            <label htmlFor={`${id}-repeat`}>Repite la contraseña</label>
            <input id={`${id}-repeat`} className="input" type="password" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} />
          </div>
        )}
        {register && (
          <p className="field-help">
            Guardamos tu correo y una versión cifrada de tu contraseña. {profile?.profileId && !isDemo ? 'El perfil de competencias de este navegador quedará asociado a tu cuenta.' : ''}
          </p>
        )}
        {error && <p className="notice notice-fiction" role="alert"><CircleAlert aria-hidden="true" /><span>{error}</span></p>}
        <button type="submit" className="btn btn-primary" disabled={busy || !email || !password || (register && !repeat)} aria-busy={busy}>
          {busy ? <LoaderCircle className="btn-spin" aria-hidden="true" /> : register ? <UserPlus aria-hidden="true" /> : <LogIn aria-hidden="true" />}
          {busy ? copy.busy : copy.submit}
        </button>
        <p className="text-sm muted">
          {copy.other.text} <Link to={copy.other.to}>{copy.other.label}</Link>
        </p>
      </form>
    </div>
  );
}
