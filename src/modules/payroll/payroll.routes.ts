import { Router } from "express";

import { validateBody } from "../../common/validate";
import { PERMISSIONS } from "../../config/permissions";
import { authGuard } from "../../guards/auth.guard";
import { permissionGuard } from "../../guards/permission.guard";
import {
  applyPayrollFormulaTemplateController,
  calculatePayrollController,
  createPayrollFormulaTemplateController,
  exportPayrollTransferFileController,
  getPayrollFormulaSettingController,
  listPayrollFormulaHistoryController,
  listPayrollRecordHistoryController,
  listPayrollFormulaTemplatesController,
  listPayrollController,
  lockPayrollController,
  restorePayrollBonusesController,
  revertPayrollFormulaHistoryController,
  revertPayrollRecordHistoryController,
  sendPayrollPayslipEmailsController,
  sendPayrollPayslipTestEmailController,
  unlockPayrollController,
  updatePayrollRecordController,
  updatePayrollFormulaSettingController,
} from "./payroll.controller";
import {
  payrollPayslipEmailDto,
  payrollPayslipTestEmailDto,
  payrollFormulaSettingDto,
  payrollFormulaTemplateCreateDto,
  payrollPeriodDto,
  payrollRecordUpdateDto,
} from "./payroll.dto";

export const payrollRoutes = Router();

payrollRoutes.use(authGuard);
payrollRoutes.get("/settings/formula", permissionGuard(PERMISSIONS.payrollRead), getPayrollFormulaSettingController);
payrollRoutes.get(
  "/settings/formula/history",
  permissionGuard(PERMISSIONS.payrollCalculate),
  listPayrollFormulaHistoryController,
);
payrollRoutes.post(
  "/settings/formula/history/:id/revert",
  permissionGuard(PERMISSIONS.payrollCalculate),
  revertPayrollFormulaHistoryController,
);
payrollRoutes.get(
  "/settings/formula/templates",
  permissionGuard(PERMISSIONS.payrollCalculate),
  listPayrollFormulaTemplatesController,
);
payrollRoutes.post(
  "/settings/formula/templates",
  permissionGuard(PERMISSIONS.payrollCalculate),
  validateBody(payrollFormulaTemplateCreateDto),
  createPayrollFormulaTemplateController,
);
payrollRoutes.post(
  "/settings/formula/templates/:id/apply",
  permissionGuard(PERMISSIONS.payrollCalculate),
  applyPayrollFormulaTemplateController,
);
payrollRoutes.put(
  "/settings/formula",
  permissionGuard(PERMISSIONS.payrollCalculate),
  validateBody(payrollFormulaSettingDto),
  updatePayrollFormulaSettingController,
);
payrollRoutes.get("/", permissionGuard(PERMISSIONS.payrollRead), listPayrollController);
payrollRoutes.get(
  "/periods/:id/record-history",
  permissionGuard(PERMISSIONS.payrollRead),
  listPayrollRecordHistoryController,
);
payrollRoutes.post(
  "/record-history/:id/revert",
  permissionGuard(PERMISSIONS.payrollCalculate),
  revertPayrollRecordHistoryController,
);
payrollRoutes.post(
  "/calculate",
  permissionGuard(PERMISSIONS.payrollCalculate),
  validateBody(payrollPeriodDto),
  calculatePayrollController,
);
payrollRoutes.post(
  "/restore-bonuses",
  permissionGuard(PERMISSIONS.payrollCalculate),
  validateBody(payrollPeriodDto),
  restorePayrollBonusesController,
);
payrollRoutes.patch(
  "/records/:id",
  permissionGuard(PERMISSIONS.payrollCalculate),
  validateBody(payrollRecordUpdateDto),
  updatePayrollRecordController,
);
payrollRoutes.post(
  "/records/:id/payslip-test-email",
  permissionGuard(PERMISSIONS.payslipEmailSend),
  validateBody(payrollPayslipTestEmailDto),
  sendPayrollPayslipTestEmailController,
);
payrollRoutes.get(
  "/periods/:id/transfer-file",
  permissionGuard(PERMISSIONS.bankTransferExport),
  exportPayrollTransferFileController,
);
payrollRoutes.post(
  "/periods/:id/payslip-emails",
  permissionGuard(PERMISSIONS.payslipEmailSend),
  validateBody(payrollPayslipEmailDto),
  sendPayrollPayslipEmailsController,
);
payrollRoutes.post("/periods/:id/lock", permissionGuard(PERMISSIONS.payrollLock), lockPayrollController);
payrollRoutes.post("/periods/:id/unlock", permissionGuard(PERMISSIONS.payrollLock), unlockPayrollController);
