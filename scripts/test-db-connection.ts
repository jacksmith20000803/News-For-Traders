import { config } from "dotenv";
config({ path: ".env" });

async function main() {
  const { db, checkDatabaseConnection } = await import("../src/lib/db");

  const attempts = 3;
  let passed = 0;

  for (let i = 1; i <= attempts; i++) {
    process.stdout.write(`Connection test ${i}/${attempts}... `);
    const ok = await checkDatabaseConnection();
    if (ok) {
      console.log("OK");
      passed++;
    } else {
      console.log("FAILED");
    }
    if (i < attempts) await new Promise((r) => setTimeout(r, 1500));
  }

  await db.$disconnect();
  console.log(`\nResult: ${passed}/${attempts} passed`);
  process.exit(passed > 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
