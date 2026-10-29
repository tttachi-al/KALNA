import { randomUUID } from 'node:crypto';
import { COMPETENCIES } from '../../src/data/competencies.js';

/**
 * Perfiles laborales en PostgreSQL: perfil, competencias (estado y nivel) y
 * sus evidencias. No guarda la conversación: solo las citas que respaldan
 * cada competencia.
 *
 * - El perfil se identifica con `profile.profileId` (uuid). Si no lo tiene,
 *   `ensureProfileId` le asigna uno antes de guardar.
 * - Guardar es idempotente: competencias por (perfil, competencia) y
 *   evidencias por (perfil, competencia, tipo, cita).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isProfileId = (id) => typeof id === 'string' && UUID.test(id);

export function ensureProfileId(profile) {
  return isProfileId(profile?.profileId) ? profile : { ...profile, profileId: randomUUID() };
}

/** Evidencias de una competencia del perfil, en filas para la base. */
function evidenceRows(c) {
  const rows = c.mentions.map((m) => ({
    kind: 'mencion',
    quote: m.quote,
    source: m.source || null,
    quality: null,
    origin: m.origin === 'qvac' ? 'qvac' : 'reglas',
    quote_type: m.type || null,
  }));
  for (const e of c.examples) {
    rows.push({
      kind: 'ejemplo',
      quote: e.text,
      source: e.source || 'evidencia',
      quality: e.level || null,
      origin: e.source === 'entrevista' ? 'qvac' : 'persona',
      quote_type: e.source === 'entrevista' ? 'ejemplo_concreto' : null,
    });
  }
  return rows.filter((r) => r.quote && r.quote.trim());
}

export function createProfileStore(pool) {
  async function save(profile) {
    if (!isProfileId(profile?.profileId)) throw new Error('El perfil no tiene profileId.');
    const id = profile.profileId;
    const exp = profile.experience || {};
    const a = profile.analysis || null;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO job_profiles (id, alias, occupations, formality, duration, missing_information,
           analysis_engine, analysis_model, analysis_prompt_version, analysis_ok, analyzed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET alias = EXCLUDED.alias, occupations = EXCLUDED.occupations,
           formality = EXCLUDED.formality, duration = EXCLUDED.duration,
           missing_information = EXCLUDED.missing_information, analysis_engine = EXCLUDED.analysis_engine,
           analysis_model = EXCLUDED.analysis_model, analysis_prompt_version = EXCLUDED.analysis_prompt_version,
           analysis_ok = EXCLUDED.analysis_ok, analyzed_at = EXCLUDED.analyzed_at, updated_at = now()`,
        [
          id,
          profile.alias || null,
          exp.occupations || [],
          exp.formality || null,
          exp.duration || null,
          a?.missingInformation || [],
          a?.engine || null,
          a?.model || null,
          a?.promptVersion || null,
          a ? Boolean(a.ok) : null,
          a?.at || null,
        ],
      );
      let evidence = 0;
      for (const c of Object.values(profile.competencies || {})) {
        if (!COMPETENCIES[c.id]) continue;
        const level = c.status === 'evidencia' ? c.level || null : null;
        await client.query(
          `INSERT INTO profile_competencies (profile_id, competency_id, status, level, level_reason, dismissed)
           VALUES ($1, $2, $3, $4, $5, false)
           ON CONFLICT (profile_id, competency_id) DO UPDATE SET status = EXCLUDED.status, level = EXCLUDED.level,
             level_reason = EXCLUDED.level_reason, dismissed = false, updated_at = now(),
             -- El texto pudo cambiar: el indexador decide si hay que regenerar el vector.
             embedding_status = 'pendiente'`,
          [id, c.id, c.status, level, level ? c.levelReason || null : null],
        );
        for (const r of evidenceRows(c)) {
          const res = await client.query(
            `INSERT INTO competency_evidence (profile_id, competency_id, kind, quote, source, quality, origin, quote_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (profile_id, competency_id, kind, md5(quote)) DO NOTHING`,
            [id, c.id, r.kind, r.quote, r.source, r.quality, r.origin, r.quote_type],
          );
          evidence += res.rowCount;
        }
      }
      // Lo que la persona quitó de su perfil queda marcado, sin borrar su historial.
      if (profile.dismissed?.length) {
        await client.query(
          'UPDATE profile_competencies SET dismissed = true, updated_at = now() WHERE profile_id = $1 AND competency_id = ANY($2)',
          [id, profile.dismissed],
        );
      }
      await client.query('COMMIT');
      return { profileId: id, newEvidence: evidence };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  /** Perfil guardado, o null si no existe. */
  async function load(id) {
    if (!isProfileId(id)) return null;
    const { rows: [p] } = await pool.query('SELECT * FROM job_profiles WHERE id = $1', [id]);
    if (!p) return null;
    const { rows: comps } = await pool.query(
      `SELECT pc.competency_id, c.name, c.description, pc.status, pc.level, pc.level_reason, pc.dismissed,
         pc.embedding_status, pc.embedding_error
       FROM profile_competencies pc JOIN competencies c ON c.id = pc.competency_id
       WHERE pc.profile_id = $1 ORDER BY pc.created_at, pc.competency_id`,
      [id],
    );
    const { rows: ev } = await pool.query(
      'SELECT competency_id, kind, quote, source, quality, origin, quote_type FROM competency_evidence WHERE profile_id = $1 ORDER BY id',
      [id],
    );
    return {
      profileId: p.id,
      alias: p.alias,
      experience: { occupations: p.occupations, formality: p.formality, duration: p.duration },
      analysis: p.analyzed_at
        ? { engine: p.analysis_engine, model: p.analysis_model, promptVersion: p.analysis_prompt_version, ok: p.analysis_ok, at: p.analyzed_at.toISOString(), missingInformation: p.missing_information }
        : null,
      competencies: comps.map((c) => ({
        id: c.competency_id,
        name: c.name,
        description: c.description,
        status: c.status,
        level: c.level,
        levelReason: c.level_reason,
        dismissed: c.dismissed,
        embeddingStatus: c.embedding_status,
        embeddingError: c.embedding_error,
        evidence: ev
          .filter((e) => e.competency_id === c.competency_id)
          .map((e) => ({ kind: e.kind, quote: e.quote, source: e.source, quality: e.quality, origin: e.origin, type: e.quote_type })),
      })),
      updatedAt: p.updated_at.toISOString(),
    };
  }

  return { save, load };
}
