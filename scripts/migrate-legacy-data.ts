#!/usr/bin/env tsx
import { config } from "dotenv";
config({ path: ".env" });

import { Prisma } from "@prisma/client";
import { Client, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

type TablePlan = {
  modelName: string;
  tableName: string;
  dependencies: string[];
};

const BATCH_SIZE = normalizePositiveInt(process.env.LEGACY_MIGRATION_BATCH_SIZE, 250);
const shouldTruncate = process.argv.includes("--truncate");

process.on("uncaughtException", handleFatalError);
process.on("unhandledRejection", handleFatalError);

async function main() {
  const sourceUrl = process.env.LEGACY_DIRECT_DATABASE_URL || process.env.LEGACY_DATABASE_URL;
  const destinationUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

  if (!sourceUrl) {
    throw new Error("LEGACY_DATABASE_URL or LEGACY_DIRECT_DATABASE_URL is required.");
  }
  if (!destinationUrl) {
    throw new Error("DATABASE_URL or DIRECT_DATABASE_URL is required.");
  }
  if (sourceUrl === destinationUrl) {
    throw new Error("Legacy and destination database URLs must be different.");
  }

  const source = new Client(sourceUrl);
  const destination = new Client(destinationUrl);

  try {
    await source.connect();
    await destination.connect();

    const tables = buildTablePlan();
    await assertTablesExist(destination, tables);

    if (shouldTruncate) {
      await truncateDestination(destination, tables);
    }

    for (const table of tables) {
      await copyTable(source, destination, table.tableName);
    }

    console.log("Legacy data migration complete.");
  } finally {
    await source.end().catch(() => undefined);
    await destination.end().catch(() => undefined);
  }
}

function buildTablePlan(): TablePlan[] {
  const models = Prisma.dmmf.datamodel.models.map((model) => ({
    modelName: model.name,
    tableName: model.dbName ?? model.name,
    dependencies: model.fields
      .filter((field) => field.kind === "object" && field.relationFromFields?.length)
      .map((field) => field.type)
      .filter((dependency) => dependency !== model.name),
  }));

  const byModelName = new Map(models.map((model) => [model.modelName, model]));
  const ordered: TablePlan[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(modelName: string) {
    if (visited.has(modelName)) return;
    if (visiting.has(modelName)) return;

    const model = byModelName.get(modelName);
    if (!model) return;

    visiting.add(modelName);
    for (const dependency of model.dependencies) {
      visit(dependency);
    }
    visiting.delete(modelName);
    visited.add(modelName);
    ordered.push(model);
  }

  for (const model of models) {
    visit(model.modelName);
  }

  return ordered;
}

async function assertTablesExist(client: Client, tables: TablePlan[]) {
  const result = await client.query<{ table_name: string }>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `
  );
  const existing = new Set(result.rows.map((row) => row.table_name));
  const missing = tables.filter((table) => !existing.has(table.tableName));

  if (missing.length > 0) {
    throw new Error(
      `Destination database is missing tables. Run "npx prisma migrate deploy" first. Missing: ${missing
        .map((table) => table.tableName)
        .join(", ")}`
    );
  }
}

async function truncateDestination(client: Client, tables: TablePlan[]) {
  const tableList = tables.map((table) => quoteIdentifier(table.tableName)).join(", ");
  console.log("Truncating destination app tables...");
  await client.query(`TRUNCATE ${tableList} RESTART IDENTITY CASCADE`);
}

async function copyTable(source: Client, destination: Client, tableName: string) {
  const columns = await getColumns(destination, tableName);
  if (columns.length === 0) {
    console.log(`${tableName}: skipped (no columns)`);
    return;
  }

  const countResult = await source.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${quoteIdentifier(tableName)}`
  );
  const total = Number(countResult.rows[0]?.count ?? 0);
  if (total === 0) {
    console.log(`${tableName}: 0 rows`);
    return;
  }

  const columnList = columns.map(quoteIdentifier).join(", ");
  const orderBy = pickOrderBy(columns);
  let copied = 0;

  while (copied < total) {
    const batch = await source.query<Record<string, unknown>>(
      `SELECT ${columnList} FROM ${quoteIdentifier(tableName)} ORDER BY ${orderBy} LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, copied]
    );

    if (batch.rows.length === 0) break;

    for (const row of batch.rows) {
      const values = columns.map((column) => row[column] ?? null);
      const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
      await destination.query(
        `INSERT INTO ${quoteIdentifier(tableName)} (${columnList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        values
      );
    }

    copied += batch.rows.length;
    console.log(`${tableName}: copied ${Math.min(copied, total)}/${total}`);
  }
}

async function getColumns(client: Client, tableName: string) {
  const result = await client.query<{ column_name: string }>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position
    `,
    [tableName]
  );

  return result.rows.map((row) => row.column_name);
}

function pickOrderBy(columns: string[]) {
  if (columns.includes("createdAt")) return quoteIdentifier("createdAt");
  if (columns.includes("updatedAt")) return quoteIdentifier("updatedAt");
  if (columns.includes("id")) return quoteIdentifier("id");
  return columns.map(quoteIdentifier).join(", ");
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function normalizePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

main().catch((error) => {
  handleFatalError(error);
});

function handleFatalError(error: unknown) {
  if (isNeonTransferQuotaError(error)) {
    console.error(
      "Legacy database is not readable because the Neon project has exceeded its data transfer quota. " +
        "Upgrade/reset that Neon project or provide a pg_dump/export, then rerun `npm run migrate:legacy-data`."
    );
  } else {
    console.error(error);
  }
  process.exit(1);
}

function isNeonTransferQuotaError(error: unknown) {
  return (
    error instanceof Error &&
    /exceeded the data transfer quota/i.test(error.message)
  );
}
