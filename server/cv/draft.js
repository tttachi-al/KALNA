const fail = (message) => { throw Object.assign(new Error(message), { status: 400 }); };
const text = (value, max = 250) => {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > max) fail('Un dato del CV tiene un formato o longitud inválidos.');
  return [...value].map((char) => char.charCodeAt(0) < 32 ? ' ' : char).join('').replace(/[\u202a-\u202e]/g, ' ').trim();
};
const list = (value, max = 12, size = 500) => {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > max) fail('Demasiados elementos en el CV.');
  return value.map((v) => text(v, size)).filter(Boolean);
};

/** User-declared facts; the language model never supplies these fields. */
export function cleanCvDraft(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Los datos del CV no son válidos.');
  const c = input.contact || {};
  if (typeof c !== 'object' || Array.isArray(c)) fail('Revisa los datos de contacto del CV.');
  const contact = Object.fromEntries(['fullName', 'title', 'phone', 'email', 'location'].map((k) => [k, text(c[k])]));
  contact.links = list(c.links, 4, 300);
  if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) fail('Revisa el correo electrónico del CV.');
  for (const url of contact.links) if (!/^https?:\/\/[^\s]+$/i.test(url)) fail('Los enlaces profesionales deben comenzar con https:// o http://.');
  const experiences = input.experiences || [];
  const education = input.education || [];
  if (!Array.isArray(experiences) || experiences.length > 8 || !Array.isArray(education) || education.length > 6) fail('Revisa las experiencias y los estudios del CV.');
  if ([...experiences, ...education].some((e) => !e || typeof e !== 'object' || Array.isArray(e))) fail('Una experiencia o un estudio tiene un formato inválido.');
  return { contact,
    experiences: experiences.map((e) => ({ organization: text(e.organization), role: text(e.role), period: text(e.period), responsibilities: list(e.responsibilities), achievements: list(e.achievements) })).filter((e) => Object.values(e).some((v) => v.length)),
    education: education.map((e) => ({ institution: text(e.institution), qualification: text(e.qualification), period: text(e.period) })).filter((e) => Object.values(e).some(Boolean)),
    certifications: list(input.certifications), languages: list(input.languages), additional: list(input.additional),
  };
}

export function createCvStore(pool) {
  return {
    async load(profileId) {
      const { rows: [row] } = await pool.query('SELECT data, target_occupation_id FROM profile_cv WHERE profile_id = $1', [profileId]);
      return { data: cleanCvDraft(row?.data || {}), targetOccupationId: row?.target_occupation_id || null };
    },
    async save(profileId, input, targetOccupationId = null) {
      const data = cleanCvDraft(input);
      await pool.query(`INSERT INTO profile_cv (profile_id, data, target_occupation_id) VALUES ($1, $2, $3)
        ON CONFLICT (profile_id) DO UPDATE SET data = EXCLUDED.data, target_occupation_id = EXCLUDED.target_occupation_id, updated_at = now()`, [profileId, data, targetOccupationId]);
      return { data, targetOccupationId };
    },
  };
}
