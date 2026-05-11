import "reflect-metadata";

import { env } from "./config/env";
import { AppDataSource } from "./database/data-source";
import { createApp } from "./app";

async function bootstrap() {
  await AppDataSource.initialize();
  const app = createApp();

  app.listen(env.PORT, () => {
    console.log(`HRM API listening on port ${env.PORT}`);
  });
}

void bootstrap();
