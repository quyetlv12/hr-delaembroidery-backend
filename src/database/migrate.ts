import "reflect-metadata";

import { AppDataSource } from "./data-source";

async function migrate() {
  await AppDataSource.initialize();
  const migrations = await AppDataSource.runMigrations();
  await AppDataSource.destroy();

  if (migrations.length === 0) {
    console.log("Không có migration chờ chạy.");
    return;
  }

  console.log(`Ran ${migrations.length} migration(s):`);
  for (const migration of migrations) {
    console.log(`- ${migration.name}`);
  }
}

void migrate();
