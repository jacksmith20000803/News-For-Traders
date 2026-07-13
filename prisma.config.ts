import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
    directUrl: process.env.DIRECT_DATABASE_URL,
  },
});
