import { Router } from "express";

import { validateBody } from "../../common/validate";
import { PERMISSIONS } from "../../config/permissions";
import { authGuard } from "../../guards/auth.guard";
import { permissionGuard } from "../../guards/permission.guard";
import {
  getEmployeeViewSettingsController,
  updateEmployeeViewSettingsController,
} from "./employee-view-settings.controller";
import { employeeViewSettingsDto } from "./employee-view-settings.dto";

export const employeeViewSettingsRoutes = Router();

employeeViewSettingsRoutes.use(authGuard);
employeeViewSettingsRoutes.get("/", permissionGuard(PERMISSIONS.payrollRead), getEmployeeViewSettingsController);
employeeViewSettingsRoutes.put(
  "/",
  permissionGuard(PERMISSIONS.attendanceImport),
  validateBody(employeeViewSettingsDto),
  updateEmployeeViewSettingsController,
);
