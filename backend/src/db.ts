import { Pool, PoolConfig } from "pg";

const connectionString = process.env.DATABASE_URL;

const requiresSSL =
  connectionString?.includes("sslmode=require") ||
  connectionString?.includes("neon.tech") ||
  process.env.PGHOST?.includes("neon.tech") ||
  process.env.PGHOST?.includes("render.com") ||
  process.env.PGHOST?.includes("supabase") ||
  process.env.PGSSLMODE === "require";

const poolConfig: PoolConfig = connectionString
  ? {
      connectionString,
      ssl: requiresSSL ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    }
  : {
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT) || 5432,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      ssl: requiresSSL ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    };

export const pool = new Pool(poolConfig);

// Handle idle connection errors gracefully without crashing the process
pool.on("error", (err) => {
  console.error("[db] Unexpected error on idle Postgres client:", err.message);
});