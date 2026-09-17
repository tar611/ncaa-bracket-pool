import "dotenv/config";
import { defineConfig } from "prisma/config";

// Uses process.env directly (not the env() helper) — env() throws
// immediately if the variable is missing, which breaks `prisma generate`
// in CI (no .env there, and generate doesn't actually need a real DB).
// Commands that do need it (db push, migrate) will still fail normally
// if DATABASE_URL is genuinely unset.
export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
