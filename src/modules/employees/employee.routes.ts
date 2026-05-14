import { Router } from "express";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import multer from "multer";

import { validateBody } from "../../common/validate";
import { PERMISSIONS } from "../../config/permissions";
import { authGuard } from "../../guards/auth.guard";
import { permissionGuard } from "../../guards/permission.guard";
import {
  createEmployeeController,
  deleteEmployeeController,
  deleteEmployeeDocumentController,
  downloadEmployeeDocumentController,
  getEmployeeController,
  listEmployeeDocumentsController,
  listEmployeeFormOptionsController,
  listEmployeesController,
  uploadEmployeeDocumentsController,
  updateEmployeeController,
} from "./employee.controller";
import { createEmployeeDto } from "./employee.dto";

export const employeeRoutes = Router();
const employeeDocumentDirectory = path.resolve(process.cwd(), "storage", "employee-documents");
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

employeeRoutes.use(authGuard);
employeeRoutes.get("/", permissionGuard(PERMISSIONS.employeesRead), listEmployeesController);
employeeRoutes.get("/form-options", permissionGuard(PERMISSIONS.employeesRead), listEmployeeFormOptionsController);
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
