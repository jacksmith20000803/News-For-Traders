import { config } from "dotenv";
import { execSync } from "child_process";

config({ path: ".env" });

async function main() {
  console.log("Generating SQL...");
  let raw = "";
  try {
    raw = execSync(
      "npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script",
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
    );
  } catch (e) {
    // prisma may exit non-zero but still output SQL
    raw = (e as { stdout?: string }).stdout ?? "";
  }

  const cleaned = raw
    .split("\n")
    .filter(
      (line) =>
        !line.startsWith("npm warn") &&
        !line.includes("prisma-config") &&
        !line.includes("pris.ly")
    )
    .join("\n")
    .trim();

  console.log(`SQL length: ${cleaned.length} chars`);

  if (cleaned.length < 100) {
    throw new Error("Failed to generate SQL");
  }

  const { db, checkDatabaseConnection } = await import("../src/lib/db");
  if (!(await checkDatabaseConnection())) throw new Error("DB connection failed");

  const statements = cleaned
    .split(";")
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim()
    )
    .filter((s) => s.length > 5);

  console.log(`Executing ${statements.length} statements...`);

  let applied = 0;
  for (const stmt of statements) {
    try {
      await db.$executeRawUnsafe(`${stmt};`);
      applied++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already exists|duplicate|42P07|42710/i.test(msg)) continue;
      console.warn("Warn:", msg.slice(0, 120));
    }
  }

  console.log(`Done: ${applied}/${statements.length} applied`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
