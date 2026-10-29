
const fs = require("fs");
const { Client } = require("pg");

// Leer DATABASE_URL desde .env sin instalar dotenv
const env = fs.readFileSync(".env", "utf8");
const match = env.match(/^DATABASE_URL=(.*)$/m);

if (!match) {
  console.error("No se encontró DATABASE_URL en .env");
  process.exit(1);
}

const connectionString = match[1].trim().replace(/^["']|["']$/g, "");

async function main() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log("Conexión correcta");

    
    const tables = await client.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND table_type = 'BASE TABLE'
    ORDER BY table_schema, table_name
    `);

    console.log("Tablas de la base de datos:");
    console.table(tables.rows);

    const extensions = await client.query(`
    SELECT extname, extversion
    FROM pg_extension
    ORDER BY extname
    `);

    console.log("Extensiones instaladas:");
    console.table(extensions.rows);

    const columns = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
        AND table_name = 'schema_migrations'
    ORDER BY ordinal_position
    `);

    console.log("Estructura de schema_migrations:");
    console.table(columns.rows);

  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
