import { Router } from "express";

import { ok } from "../../common/api-response";
import { moduleStatus } from "../../common/module-status";
import { PERMISSIONS } from "../../config/permissions";
import { authGuard } from "../../guards/auth.guard";
import { permissionGuard } from "../../guards/permission.guard";

export const reportsRoutes = Router();

reportsRoutes.use(authGuard);
reportsRoutes.get("/", permissionGuard(PERMISSIONS.reportsRead), (_req, res) =>
  ok(res, moduleStatus("reports", ["báo cáo nhân viên", "báo cáo chấm công", "báo cáo lương"])),
);
