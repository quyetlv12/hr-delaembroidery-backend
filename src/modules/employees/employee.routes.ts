import { Router } from "express";

import { validateBody } from "../../common/validate";
import { PERMISSIONS } from "../../config/permissions";
import { authGuard } from "../../guards/auth.guard";
import { permissionGuard } from "../../guards/permission.guard";
import {
  createEmployeeController,
  deleteEmployeeController,
  getEmployeeController,
  listEmployeeFormOptionsController,
  listEmployeesController,
  updateEmployeeController,
} from "./employee.controller";
import { createEmployeeDto } from "./employee.dto";

export const employeeRoutes = Router();

employeeRoutes.use(authGuard);
employeeRoutes.get("/", permissionGuard(PERMISSIONS.employeesRead), listEmployeesController);
employeeRoutes.get("/form-options", permissionGuard(PERMISSIONS.employeesRead), listEmployeeFormOptionsController);
employeeRoutes.get("/:id", permissionGuard(PERMISSIONS.employeesRead), getEmployeeController);
employeeRoutes.post(
  "/",
  permissionGuard(PERMISSIONS.employeesCreate),
  validateBody(createEmployeeDto),
  createEmployeeController,
);
employeeRoutes.put(
  "/:id",
  permissionGuard(PERMISSIONS.employeesUpdate),
  validateBody(createEmployeeDto),
  updateEmployeeController,
);
employeeRoutes.delete("/:id", permissionGuard(PERMISSIONS.employeesDelete), deleteEmployeeController);
