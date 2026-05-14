import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env";
import { authRoutes } from "./modules/auth/auth.routes";
import { attendanceRoutes } from "./modules/attendance/attendance.routes";
import { bankTransferRoutes } from "./modules/bank-transfer/bank-transfer.routes";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes";
import { employeeViewSettingsRoutes } from "./modules/employee-view-settings/employee-view-settings.routes";
import { employeeRoutes } from "./modules/employees/employee.routes";
import { organizationRoutes } from "./modules/organization/organization.routes";
import { payrollRoutes } from "./modules/payroll/payroll.routes";
import { reportsRoutes } from "./modules/reports/reports.routes";
import { rolesPermissionRoutes } from "./modules/roles-permissions/roles-permissions.routes";
import { errorMiddleware } from "./middlewares/error.middleware";
import { notFoundMiddleware } from "./middlewares/not-found.middleware";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(`${env.API_PREFIX}/auth`, authRoutes);
  app.use(`${env.API_PREFIX}/dashboard`, dashboardRoutes);
  app.use(`${env.API_PREFIX}/employees`, employeeRoutes);
  app.use(`${env.API_PREFIX}/employee-view-settings`, employeeViewSettingsRoutes);
  app.use(`${env.API_PREFIX}/organization`, organizationRoutes);
  app.use(`${env.API_PREFIX}/attendance`, attendanceRoutes);
  app.use(`${env.API_PREFIX}/payroll`, payrollRoutes);
  app.use(`${env.API_PREFIX}/bank-transfer`, bankTransferRoutes);
  app.use(`${env.API_PREFIX}/roles-permissions`, rolesPermissionRoutes);
  app.use(`${env.API_PREFIX}/reports`, reportsRoutes);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
