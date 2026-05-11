import { Router } from "express";

import { validateBody } from "../../common/validate";
import { PERMISSIONS } from "../../config/permissions";
import { authGuard } from "../../guards/auth.guard";
import { permissionGuard } from "../../guards/permission.guard";
import {
  createDepartmentController,
  createPositionController,
  deleteDepartmentController,
  deletePositionController,
  getDepartmentController,
  getPositionController,
  listDepartmentsController,
  listPositionsController,
  updateDepartmentController,
  updatePositionController,
} from "./organization.controller";
import { saveDepartmentDto, savePositionDto } from "./organization.dto";

export const organizationRoutes = Router();

organizationRoutes.use(authGuard);

organizationRoutes.get("/departments", permissionGuard(PERMISSIONS.employeesRead), listDepartmentsController);
organizationRoutes.get("/departments/:id", permissionGuard(PERMISSIONS.employeesRead), getDepartmentController);
organizationRoutes.post(
  "/departments",
  permissionGuard(PERMISSIONS.employeesCreate),
  validateBody(saveDepartmentDto),
  createDepartmentController,
);
organizationRoutes.put(
  "/departments/:id",
  permissionGuard(PERMISSIONS.employeesUpdate),
  validateBody(saveDepartmentDto),
  updateDepartmentController,
);
organizationRoutes.delete(
  "/departments/:id",
  permissionGuard(PERMISSIONS.employeesDelete),
  deleteDepartmentController,
);

organizationRoutes.get("/positions", permissionGuard(PERMISSIONS.employeesRead), listPositionsController);
organizationRoutes.get("/positions/:id", permissionGuard(PERMISSIONS.employeesRead), getPositionController);
organizationRoutes.post(
  "/positions",
  permissionGuard(PERMISSIONS.employeesCreate),
  validateBody(savePositionDto),
  createPositionController,
);
organizationRoutes.put(
  "/positions/:id",
  permissionGuard(PERMISSIONS.employeesUpdate),
  validateBody(savePositionDto),
  updatePositionController,
);
organizationRoutes.delete("/positions/:id", permissionGuard(PERMISSIONS.employeesDelete), deletePositionController);
