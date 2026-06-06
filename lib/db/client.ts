import { neon } from "@neondatabase/serverless";

type NeonSql = ReturnType<typeof neon>;

let sqlClient: NeonSql | null = null;

export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }

  return sqlClient;
}
