-- 001 · Conversaciones del diagnóstico y sus mensajes.
--
-- KALLPA todavía no tiene cuentas de usuario: la persona solo da un alias
-- dentro de la conversación (session.profile.alias). Por eso no hay tabla de
-- usuarios ni clave foránea hacia ella; se añadirá en una migración posterior
-- cuando exista ese sistema.

CREATE TABLE conversations (
  -- Mismo id que session.id (lo genera el motor, p. ej. "s-mh3k2-1a").
  id          text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 80),
  mode        text NOT NULL,                 -- 'adaptativo' (QVAC) u otro modo futuro
  stage       text NOT NULL,                 -- etapa actual de la conversación
  done        boolean NOT NULL DEFAULT false,
  alias       text,                          -- nombre que dio la persona (opcional)
  -- Copia completa de la sesión (perfil, estado de la entrevista…) para
  -- retomar la conversación tras reiniciar el servidor.
  session     jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX conversations_updated_at_idx ON conversations (updated_at DESC);

CREATE TABLE conversation_messages (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id  text NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  message_id       text NOT NULL,           -- Message.id del contrato
  position         integer NOT NULL CHECK (position >= 0),
  role             text NOT NULL CHECK (role IN ('bot', 'user')),
  kind             text NOT NULL DEFAULT 'text',
  text             text NOT NULL DEFAULT '',
  data             jsonb,                   -- Message.data (metadatos de la entrevista, etc.)
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, message_id)
);

CREATE INDEX conversation_messages_order_idx ON conversation_messages (conversation_id, position);
