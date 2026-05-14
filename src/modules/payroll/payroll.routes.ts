import { Router } from "express";

import { validateBody } from "../../common/validate";
import { PERMISSIONS } from "../../config/permissions";
import { authGuard } from "../../guards/auth.guard";
import { permissionGuard } from "../../guards/permission.guard";
import {
  calculatePayrollController,
  exportPayrollTransferFileController,
  getPayrollFormulaSettingController,
  listPayrollController,
  lockPayrollController,
  updatePayrollFormulaSettingController,
} from "./payroll.controller";
import { payrollFormulaSettingDto, payrollPeriodDto } from "./payroll.dto";

export const payrollRoutes = Router();

payrollRoutes.use(authGuard);
payrollRoutes.get("/settings/formula", permissionGuard(PERMISSIONS.payrollRead), getPayrollFormulaSettingController);
payrollRoutes.put(
  "/settings/formula",
  permissionGuard(PERMISSIONS.payrollCalculate),
  validateBody(payrollFormulaSettingDto),
  updatePayrollFormulaSettingController,
);
payrollRoutes.get("/", permissionGuard(PERMISSIONS.payrollRead), listPayrollController);
payrollRoutes.post(
  "/calculate",
  permissionGuard(PERMISSIONS.payrollCalculate),
  validateBody(payrollPeriodDto),
  calculatePayrollController,
);
payrollRoutes.get(
  "/periods/:id/transfer-file",
  permissionGuard(PERMISSIONS.bankTransferExport),
  exportPayrollTransferFileController,
);
payrollRoutes.post("/periods/:id/lock", permissionGuard(PERMISSIONS.payrollLock), lockPayrollController);
