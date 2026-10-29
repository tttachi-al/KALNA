import { CircleAlert, LoaderCircle, LogIn, LogOut, Trash2, UserPlus } from 'lucide-react';
import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dialog } from '../components/ui/Dialog.jsx';
import { useToast } from '../components/ui/toastContext.js';
import { kallpaService } from '../services/kallpaService.js';
import { useAuth } from '../state/authContext.js';
import { useKallpa } from '../state/useKallpa.js';
import './account.css';

const CONFIRMATION = 'ELIMINAR';

function formatDate(iso) {
  return new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

/** Confirmación de borrado: explica qué se elimina y pide la contraseña y la palabra ELIMINAR. */
function DeleteAccountDialog({ open, onClose, onDeleted }) {
  const { refresh } = useAuth();
  const id = useId();
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const ready = password && typed.trim() === CONFIRMATION;

  const close = () => {
    if (busy) return;
    setPassword('');
    setTyped('');
    setError(null);
    onClose();
  };
  const confirm = async (e) => {
    e?.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await kallpaService.deleteAccount({ password, confirmation: CONFIRMATION });
      if (!r?.deleted) throw new Error('El servidor no confirmó la eliminación. Tu cuenta sigue activa.');
      onDeleted(r);
    } catch (err) {
      setError(err.message);
      // Si la sesión expiró, la pantalla se actualiza para reflejarlo.
      if (/sesión expiró|Inicia sesión/.test(err.message)) refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      title="¿Eliminar tu cuenta?"
      onClose={close}
      actions={
        <>
          <button type="button" className="btn" onClick={close} disabled={busy}>Cancelar</button>
          <button type="submit" form={`${id}-form`} className="btn btn-danger" disabled={!ready || busy} aria-busy={busy}>
            {busy ? <LoaderCircle className="btn-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
            {busy ? 'Eliminando…' : 'Eliminar definitivamente'}
          </button>
        </>
      }
    >
      <form id={`${id}-form`} className="stack-sm account-delete" onSubmit={confirm}>
        <p><strong>Esta acción es irreversible.</strong> Se eliminarán de Kalna:</p>
        <ul className="text-sm">
          <li>Tu cuenta: correo, contraseña cifrada y sesiones.</li>
          <li>Los perfiles asociados: experiencia declarada, competencias, ejemplos y citas que las respaldan.</li>
          <li>Los datos derivados: búsquedas semánticas (embeddings), rutas, pasaportes y datos del CV.</li>
          <li>Tus evaluaciones de competencias y sus resultados. Las constancias que ya descargaste quedan en tu dispositivo.</li>
        </ul>
        <p className="text-sm">También se borrarán los datos de Kalna guardados en este navegador. Los registros técnicos del servidor pueden conservar por un tiempo fechas e identificadores parciales, sin tu correo ni tus respuestas.</p>
        <div className="field">
          <label htmlFor={`${id}-pass`}>Escribe tu contraseña para confirmar que eres tú</label>
          <input id={`${id}-pass`} className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-word`}>Escribe {CONFIRMATION} para confirmar</label>
          <input id={`${id}-word`} className="input" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={busy} />
        </div>
        {error && <p className="notice notice-fiction" role="alert"><CircleAlert aria-hidden="true" /><span>{error}</span></p>}
      </form>
    </Dialog>
  );
}

export default function AccountPage() {
  const { user, status, signOut, setUser } = useAuth();
  const { resetAll } = useKallpa();
  const navigate = useNavigate();
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState(null);

  if (status === 'loading') {
    return <div className="page account"><p role="status" className="loading-notice"><LoaderCircle className="loading-spin" aria-hidden="true" /> Comprobando tu sesión…</p></div>;
  }

  if (!user) {
    return (
      <div className="page account">
        <header className="page-header"><div><p className="eyebrow">Tu cuenta</p><h1>Mi cuenta</h1></div></header>
        <section className="card stack-sm account-form">
          <p>{status === 'unavailable' ? 'No se pudo conectar con el servidor de Kalna para comprobar tu sesión.' : 'Inicia sesión para ver y gestionar tu cuenta.'}</p>
          <div className="row">
            <Link to="/iniciar-sesion" className="btn"><LogIn aria-hidden="true" /> Iniciar sesión</Link>
            <Link to="/crear-cuenta" className="btn btn-primary"><UserPlus aria-hidden="true" /> Crear cuenta</Link>
          </div>
        </section>
      </div>
    );
  }

  const logout = async () => {
    setLeaving(true);
    setError(null);
    try {
      await signOut();
      toast.show('Cerraste sesión.');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLeaving(false);
    }
  };

  const deleted = () => {
    // Solo llega aquí cuando el backend confirmó la eliminación y cerró la sesión.
    setDeleting(false);
    setUser(null);
    resetAll();
    navigate('/', { replace: true });
    toast.show('Tu cuenta y sus datos se eliminaron de Kalna.');
  };

  return (
    <div className="page account">
      <header className="page-header">
        <div>
          <p className="eyebrow">Tu cuenta</p>
          <h1>Mi cuenta</h1>
        </div>
      </header>

      <section className="card stack-sm" aria-labelledby="account-data">
        <h2 id="account-data" className="card-title">Datos de la cuenta</h2>
        <dl className="account-dl">
          <div><dt>Correo</dt><dd>{user.email}</dd></div>
          <div><dt>Creada el</dt><dd>{formatDate(user.createdAt)}</dd></div>
          <div><dt>Perfiles asociados</dt><dd>{user.profileIds.length}</dd></div>
        </dl>
        {error && <p className="notice notice-fiction" role="alert"><CircleAlert aria-hidden="true" /><span>{error}</span></p>}
        <div className="row">
          <button type="button" className="btn" onClick={logout} disabled={leaving} aria-busy={leaving}>
            {leaving ? <LoaderCircle className="btn-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
            Cerrar sesión
          </button>
        </div>
      </section>

      <section className="card stack-sm account-danger" aria-labelledby="account-delete">
        <h2 id="account-delete" className="card-title">Eliminar cuenta</h2>
        <p className="muted text-sm">Borra tu cuenta y todos los datos de Kalna asociados a ella. No se puede deshacer.</p>
        <div className="row">
          <button type="button" className="btn btn-ghost account-delete-btn" onClick={() => setDeleting(true)}>
            <Trash2 aria-hidden="true" /> Eliminar cuenta
          </button>
        </div>
      </section>

      <DeleteAccountDialog open={deleting} onClose={() => setDeleting(false)} onDeleted={deleted} />
    </div>
  );
}
