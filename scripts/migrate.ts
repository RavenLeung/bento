import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required. Add it to .env.local or export it before running.");
  process.exit(1);
}

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  ssl: databaseUrl.includes("sslmode=require") ? "require" : false,
  onnotice: () => undefined
});

const migrationsDir = path.join(process.cwd(), "lib", "db", "migrations");

try {
  await sql`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    console.log("No SQL migrations found.");
  }

  for (const file of files) {
    const [applied] = await sql<Array<{ filename: string }>>`
      select filename from schema_migrations where filename = ${file} limit 1
    `;
    if (applied) {
      console.log(`skip  ${file}`);
      continue;
    }

    const contents = await readFile(path.join(migrationsDir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(contents);
      await tx`insert into schema_migrations (filename) values (${file})`;
    });
    console.log(`apply ${file}`);
  }

  console.log("Database is up to date.");
} catch (error) {
  console.error("Migration failed:", error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
