import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load .env.local (Next.js convention) for Drizzle Kit CLI
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
