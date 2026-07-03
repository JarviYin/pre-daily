import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Lazily-initialised singleton so merely importing this module never throws
// when DATABASE_URL is absent (e.g. `next build` before the DB is provisioned).
// The connection is created only on first actual query; callers wrap reads in
// try/catch and degrade to an empty/standby state.
const globalForDb = globalThis as unknown as {
  _pgClient?: ReturnType<typeof postgres>;
  _db?: ReturnType<typeof drizzle<typeof schema>>;
};

export function getDb() {
  if (globalForDb._db) return globalForDb._db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client =
    globalForDb._pgClient ?? postgres(url, { prepare: false, max: 5 });
  // Cache in EVERY environment. Skipping the cache in production meant each
  // getDb() call during `next build` SSG spawned a fresh max-5 pool that was
  // never closed — once the archive grew past ~30 editions the parallel
  // prerender exceeded Postgres max_connections (53300 "too many clients").
  globalForDb._pgClient = client;
  const db = drizzle(client, { schema });
  globalForDb._db = db;
  return db;
}

export { schema };
