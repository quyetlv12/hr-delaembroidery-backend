import "reflect-metadata";

import { env } from "./config/env";
import { AppDataSource } from "./database/data-source";
import { createApp } from "./app";
import { startAttendanceServerAutoSync } from "./modules/attendance/attendance-server-auto-sync.service";

async function bootstrap() {
  await AppDataSource.initialize();
  startAttendanceServerAutoSync();
  const app = createApp();

  app.listen(env.PORT, () => {
    console.log(`HRM API listening on port ${env.PORT}`);
  });
}

void bootstrap();
