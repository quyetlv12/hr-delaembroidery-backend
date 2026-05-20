import { Router } from "express";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import multer from "multer";

import { HttpError } from "../../common/http-error";
import { validateBody } from "../../common/validate";
import { PERMISSIONS } from "../../config/permissions";
import { authGuard } from "../../guards/auth.guard";
import { permissionGuard } from "../../guards/permission.guard";
import {
  createEmployeeController,
  deleteEmployeeController,
  deleteEmployeeAvatarController,
  deleteEmployeeDocumentController,
  downloadEmployeeDocumentController,
  getEmployeeController,
  increaseEmployeeSalariesController,
  listEmployeeDocumentsController,
  listEmployeeFormOptionsController,
  listEmployeeMonthlyBonusHistoryController,
  listEmployeeSalaryHistoriesController,
  listEmployeeSalaryHistoryController,
  listEmployeesController,
  uploadEmployeeAvatarController,
  uploadEmployeeDocumentsController,
  updateEmployeeController,
  updateEmployeeMonthlyBonusController,
  updateEmployeeSalaryController,
  updateEmployeeTimekeepingCodeController,
} from "./employee.controller";
import {
  createEmployeeDto,
  increaseEmployeeSalaryDto,
  updateEmployeeMonthlyBonusDto,
  updateEmployeeSalaryDto,
  updateEmployeeTimekeepingCodeDto,
} from "./employee.dto";

export const employeeRoutes = Router();
const employeeDocumentDirectory = path.resolve(process.cwd(), "storage", "employee-documents");
const employeeAvatarDirectory = path.resolve(process.cwd(), "storage", "employee-avatars");
const allowedAvatarMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const documentUpload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, callback) {
      mkdirSync(employeeDocumentDirectory, { recursive: true });
      callback(null, employeeDocumentDirectory);
    },
    filename(_req, file, callback) {
      const extension = path.extname(file.originalname);
      callback(null, `${Date.now()}-${randomUUID()}${extension}`);
    },
  }),
});
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, callback) {
      mkdirSync(employeeAvatarDirectory, { recursive: true });
      callback(null, employeeAvatarDirectory);
    },
    filename(_req, file, callback) {
      const extension = path.extname(file.originalname);
      callback(null, `${Date.now()}-${randomUUID()}${extension}`);
    },
  }),
  fileFilter(_req, file, callback) {
    if (allowedAvatarMimeTypes.has(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new HttpError(400, "EMPLOYEE_AVATAR_INVALID_TYPE", "Avatar phải là file ảnh"));
  },
});

employeeRoutes.use(authGuard);
employeeRoutes.get("/", permissionGuard(PERMISSIONS.employeesRead), listEmployeesController);
employeeRoutes.get("/form-options", permissionGuard(PERMISSIONS.employeesRead), listEmployeeFormOptionsController);
employeeRoutes.get(
  "/salary-history",
  permissionGuard(PERMISSIONS.employeesRead),
  listEmployeeSalaryHistoriesController,
);
employeeRoutes.get(
  "/:id/salary-history",
  permissionGuard(PERMISSIONS.employeesRead),
  listEmployeeSalaryHistoryController,
);
employeeRoutes.get(
  "/:id/monthly-bonus-history",
  permissionGuard(PERMISSIONS.employeesRead),
  listEmployeeMonthlyBonusHistoryController,
);
employeeRoutes.get("/:id/documents", permissionGuard(PERMISSIONS.employeesRead), listEmployeeDocumentsController);
employeeRoutes.post(
  "/:id/documents",
  permissionGuard(PERMISSIONS.employeesUpdate),
  documentUpload.array("files"),
  uploadEmployeeDocumentsController,
);
employeeRoutes.get(
  "/:id/documents/:documentId/download",
  permissionGuard(PERMISSIONS.employeesRead),
  downloadEmployeeDocumentController,
);
employeeRoutes.delete(
  "/:id/documents/:documentId",
  permissionGuard(PERMISSIONS.employeesUpdate),
  deleteEmployeeDocumentController,
);
employeeRoutes.post(
  "/:id/avatar",
  permissionGuard(PERMISSIONS.employeesUpdate),
  avatarUpload.single("avatar"),
  uploadEmployeeAvatarController,
);
employeeRoutes.delete(
  "/:id/avatar",
  permissionGuard(PERMISSIONS.employeesUpdate),
  deleteEmployeeAvatarController,
);
employeeRoutes.get("/:id", permissionGuard(PERMISSIONS.employeesRead), getEmployeeController);
employeeRoutes.post(
  "/",
  permissionGuard(PERMISSIONS.employeesCreate),
  validateBody(createEmployeeDto),
  createEmployeeController,
);
employeeRoutes.post(
  "/salary-increase",
  permissionGuard(PERMISSIONS.employeesUpdate),
  validateBody(increaseEmployeeSalaryDto),
  increaseEmployeeSalariesController,
);
employeeRoutes.patch(
  "/:id/salary",
  permissionGuard(PERMISSIONS.employeesUpdate),
  validateBody(updateEmployeeSalaryDto),
  updateEmployeeSalaryController,
);
employeeRoutes.patch(
  "/:id/timekeeping-code",
  permissionGuard(PERMISSIONS.employeesUpdate),
  validateBody(updateEmployeeTimekeepingCodeDto),
  updateEmployeeTimekeepingCodeController,
);
employeeRoutes.patch(
  "/:id/monthly-bonus",
  permissionGuard(PERMISSIONS.employeesUpdate),
  validateBody(updateEmployeeMonthlyBonusDto),
  updateEmployeeMonthlyBonusController,
);
employeeRoutes.put(
  "/:id",
  permissionGuard(PERMISSIONS.employeesUpdate),
  validateBody(createEmployeeDto),
  updateEmployeeController,
);
employeeRoutes.delete("/:id", permissionGuard(PERMISSIONS.employeesDelete), deleteEmployeeController);
