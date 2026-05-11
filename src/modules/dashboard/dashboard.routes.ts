import { Router } from "express";

import { PERMISSIONS } from "../../config/permissions";
import { authGuard } from "../../guards/auth.guard";
import { permissionGuard } from "../../guards/permission.guard";
import { dashboardSummaryController } from "./dashboard.controller";

export const dashboardRoutes = Router();

dashboardRoutes.use(authGuard);
dashboardRoutes.get("/summary", permissionGuard(PERMISSIONS.dashboardRead), dashboardSummaryController);
