import "reflect-metadata";
import { DataSource } from "typeorm";

import { env } from "../config/env";
import * as entities from "../entities";

export const AppDataSource = new DataSource({
  type: "mysql",
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  entities: Object.values(entities),
  timezone: "+07:00",
  migrations: [
    process.env.NODE_ENV === "production" 
      ? "dist/migrations/*.js" 
      : "src/migrations/*.ts"
  ],
  synchronize: false,
  logging: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});
