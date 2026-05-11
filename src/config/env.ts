import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default("/api"),
  FRONTEND_ORIGIN: z.string().default("http://localhost:5173"),
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().default("root"),
  DB_PASSWORD: z.string().default(""),
  DB_NAME: z.string().default("hrm_system"),
  JWT_SECRET: z
    .string()
    .min(12, "JWT_SECRET must be at least 12 characters")
    .default("development-secret-change-me"),
  JWT_EXPIRES_IN: z.string().default("1d"),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("HRM System <no-reply@example.com>"),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  TEST_EMPLOYEE_EMAIL: z.string().email().default("employee@example.com"),
  TEST_EMPLOYEE_PASSWORD: z.string().min(8).default("123456789"),
});

export const env = envSchema.parse(process.env);
