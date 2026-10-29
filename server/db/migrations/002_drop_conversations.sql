-- 002 · Retira el almacenamiento de transcripciones.
--
-- KALLPA ya no guarda conversaciones ni mensajes del chatbot en PostgreSQL:
-- la base conserva solo información útil para la empleabilidad (ver 003).
-- La única dependencia de `conversations` es la clave foránea de
-- `conversation_messages`, por eso se borra primero la tabla hija.
-- Sin CASCADE: si apareciera otra dependencia, la migración falla y no borra nada.

DROP TABLE conversation_messages;
DROP TABLE conversations;
