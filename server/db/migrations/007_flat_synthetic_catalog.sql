-- 007 · Catálogo sintético PLANO: se retira la segmentación por perfiles de origen.
--
-- Los empleos sintéticos son una sola colección de 100 empleos (occupations
-- con is_synthetic = true), sin agrupaciones por perfiles, sectores ni
-- categorías. Se eliminan las tablas creadas en 006 solo para esa
-- segmentación; contienen únicamente datos generados por el catálogo
-- sintético. Los empleos, sus competencias y sus requisitos se conservan.
-- Sin CASCADE: se borran en orden de dependencias y, si apareciera otra
-- dependencia, la migración falla sin borrar nada.

DROP TABLE origin_profile_occupation_gaps;
DROP TABLE origin_profile_occupations;
DROP TABLE origin_profile_competencies;
DROP TABLE origin_profiles;
