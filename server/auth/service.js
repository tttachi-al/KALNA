import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { isProfileId } from '../db/profiles.js';

/**
 * Cuentas de KALLPA: correo + contraseña, sesiones y eliminación de cuenta.
 *
 * - Contraseña: scrypt (N=16384, r=8, p=1) con sal aleatoria; comparación en tiempo constante.
 * - Sesión: token aleatorio de 32 bytes en una cookie HttpOnly; la base guarda solo su SHA-256.
 * - Al registrarse o iniciar sesión, el perfil anónimo de ese navegador (profileId) se
 *   vincula a la cuenta si todavía no pertenece a nadie.
 * - Eliminar la cuenta exige sesión válida y la contraseña de nuevo, y solo actúa
 *   sobre la cuenta de esa sesión.
 */
const scrypt = promisify(scryptCb);
export const SESSION_COOKIE = 'kallpa_session';
export const SESSION_DAYS = 30;
export const DELETE_CONFIRMATION = 'ELIMINAR';
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

const fail = (status, message, code) => { throw Object.assign(new Error(message), { status, code }); };
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [kind, N, r, p, salt, key] = String(stored).split('$');
  if (kind !== 'scrypt' || !salt || !key) return false;
  const expected = Buffer.from(key, 'base64');
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return timingSafeEqual(actual, expected);
}

function cleanCredentials(body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!EMAIL.test(email)) fail(400, 'Escribe un correo electrónico válido.', 'invalid_email');
  if (!password) fail(400, 'Escribe tu contraseña.', 'missing_password');
  if (password.length > MAX_PASSWORD) fail(400, 'La contraseña es demasiado larga.', 'invalid_password');
  return { email, password };
}

export function createAuthService({ pool, log = () => {}, now = () => Date.now() }) {
  const failures = new Map();

  function checkLock(email) {
    const f = failures.get(email);
    if (f && f.count >= MAX_FAILURES && now() - f.at < LOCK_MS) fail(429, 'Demasiados intentos fallidos. Espera unos minutos antes de volver a intentarlo.', 'too_many_attempts');
  }
  function recordFailure(email) {
    const f = failures.get(email);
    failures.set(email, { count: f && now() - f.at < LOCK_MS ? f.count + 1 : 1, at: now() });
  }

  async function createSession(userId) {
    const token = randomBytes(32).toString('base64url');
    const expires = new Date(now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await pool.query('INSERT INTO account_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [sha256(token), userId, expires]);
    return { token, expires };
  }

  /** Vincula el perfil de este navegador a la cuenta, solo si aún no tiene dueño. */
  async function claimProfile(userId, profileId) {
    if (!isProfileId(profileId)) return false;
    const r = await pool.query('UPDATE job_profiles SET user_id = $1 WHERE id = $2 AND user_id IS NULL', [userId, profileId]);
    return r.rowCount > 0;
  }

  async function describe(user) {
    const { rows } = await pool.query('SELECT id FROM job_profiles WHERE user_id = $1 ORDER BY created_at', [user.id]);
    return { email: user.email, createdAt: user.created_at.toISOString(), profileIds: rows.map((r) => r.id) };
  }

  return {
    async register(body) {
      const { email, password } = cleanCredentials(body);
      if (password.length < MIN_PASSWORD) fail(400, `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`, 'weak_password');
      const hash = await hashPassword(password);
      const { rows: [user] } = await pool.query('INSERT INTO user_accounts (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING RETURNING *', [email, hash]);
      if (!user) fail(409, 'Ya existe una cuenta con ese correo. Inicia sesión.', 'email_taken');
      await claimProfile(user.id, body?.profileId);
      const session = await createSession(user.id);
      log(`Cuenta creada ${user.id.slice(0, 8)}`);
      return { user: await describe(user), session };
    },

    async login(body) {
      const { email, password } = cleanCredentials(body);
      checkLock(email);
      const { rows: [user] } = await pool.query('SELECT * FROM user_accounts WHERE email = $1', [email]);
      // Se calcula el hash aunque el correo no exista, para no revelar qué cuentas existen por el tiempo de respuesta.
      const ok = user ? await verifyPassword(password, user.password_hash) : (await hashPassword(password), false);
      if (!ok) {
        recordFailure(email);
        fail(401, 'Correo o contraseña incorrectos.', 'invalid_credentials');
      }
      failures.delete(email);
      await claimProfile(user.id, body?.profileId);
      return { user: await describe(user), session: await createSession(user.id) };
    },

    /** Usuario de la cookie de sesión, o null si no hay sesión válida. */
    async userFromToken(token) {
      if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
      const { rows: [user] } = await pool.query(
        'SELECT u.* FROM account_sessions s JOIN user_accounts u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()', [sha256(token)]);
      return user || null;
    },

    describe,

    async logout(token) {
      if (typeof token === 'string' && token) await pool.query('DELETE FROM account_sessions WHERE token_hash = $1', [sha256(token)]);
    },

    /**
     * Elimina la cuenta de la sesión: sus perfiles (y en cascada competencias,
     * evidencias, embeddings, rutas, pasaportes, CV y evaluaciones), sus sesiones y la cuenta.
     */
    async deleteAccount(user, body) {
      if (!user) fail(401, 'Inicia sesión para eliminar tu cuenta.', 'not_authenticated');
      if (body?.confirmation !== DELETE_CONFIRMATION) fail(400, `Escribe ${DELETE_CONFIRMATION} para confirmar.`, 'missing_confirmation');
      const password = typeof body?.password === 'string' ? body.password : '';
      checkLock(user.email);
      if (!password || !(await verifyPassword(password, user.password_hash))) {
        recordFailure(user.email);
        fail(401, 'La contraseña no es correcta. No se eliminó nada.', 'invalid_credentials');
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows: [counts] } = await client.query(`SELECT
            (SELECT count(*) FROM job_profiles WHERE user_id = $1)::int AS profiles,
            (SELECT count(*) FROM profile_competencies pc JOIN job_profiles p ON p.id = pc.profile_id WHERE p.user_id = $1)::int AS competencies,
            (SELECT count(*) FROM competency_evidence e JOIN job_profiles p ON p.id = e.profile_id WHERE p.user_id = $1)::int AS evidence,
            (SELECT count(*) FROM competency_assessments a JOIN job_profiles p ON p.id = a.profile_id WHERE p.user_id = $1)::int AS assessments`, [user.id]);
        await client.query('DELETE FROM job_profiles WHERE user_id = $1', [user.id]);
        const r = await client.query('DELETE FROM user_accounts WHERE id = $1', [user.id]);
        if (r.rowCount !== 1) throw new Error('La cuenta no se encontró al eliminarla.');
        await client.query('COMMIT');
        failures.delete(user.email);
        log(`Cuenta eliminada ${user.id.slice(0, 8)}`);
        return { deleted: true, removed: counts };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
