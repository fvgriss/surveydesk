import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Use connection pooling for serverless (Vercel)
// Supabase provides a pooler on port 6543
const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, {
  prepare: false, // required for Supabase connection pooler (transaction mode)
  max: 1, // single connection per serverless invocation
});

export const db = drizzle(client, { schema });
export type Database = typeof db;
