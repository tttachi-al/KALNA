import pg from 'pg';

/**
 * Pool de conexiones a PostgreSQL a partir de DATABASE_URL.
 * Devuelve null si no hay URL: el backend funciona entonces solo en memoria.
 */
export function createPool(url) {
  if (!url) return null;
  const pool = new pg.Pool({ connectionString: url, max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
  // Un error de un cliente inactivo no debe tumbar el servidor.
  pool.on('error', () => {});
  return pool;
}

/** Describe la conexión sin credenciales (para registros y /health). */
export function describeUrl(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return 'URL no válida';
  }
}
