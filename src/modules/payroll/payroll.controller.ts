import type { Request, Response } from "express";

import { ok } from "../../common/api-response";
import { HttpError } from "../../common/http-error";
import { PERMISSIONS } from "../../config/permissions";
import { PayrollService } from "./payroll.service";
import type { PayrollFormulaSettingDto } from "./payroll.dto";

const payrollService = new PayrollService();

export async function listPayrollController(req: Request, res: Response) {
  const month = Number(req.query.month);
  const year = Number(req.query.year);
  if (!month || !year) {
    throw new HttpError(400, "INVALID_PAYROLL_PERIOD", "Vui lòng nhập tháng và năm");
  }

  const canViewAllPayroll =
    req.user?.permissions.includes(PERMISSIONS.payrollCalculate) ||
    req.user?.permissions.includes(PERMISSIONS.payrollLock) ||
    req.user?.permissions.includes(PERMISSIONS.bankTransferExport);
  const employeeScopeId = canViewAllPayroll ? undefined : req.user?.employeeId;
  if (!employeeScopeId && !canViewAllPayroll) {
    throw new HttpError(403, "EMPLOYEE_PROFILE_REQUIRED", "Tài khoản chưa liên kết hồ sơ nhân viên");
  }

  const payroll = await payrollService.list({ month, year }, employeeScopeId);
  return ok(res, payroll);
}

export async function calculatePayrollController(req: Request, res: Response) {
  const payroll = await payrollService.calculatePeriod(req.body);
  return ok(res, payroll, "Đã tính lương");
}

export async function getPayrollFormulaSettingController(_req: Request, res: Response) {
  const settings = await payrollService.getFormulaSetting();
  return ok(res, settings);
}

export async function updatePayrollFormulaSettingController(
  req: Request<unknown, unknown, PayrollFormulaSettingDto>,
  res: Response,
) {
  const settings = await payrollService.updateFormulaSetting(req.body);
  return ok(res, settings, "Đã cập nhật công thức bảng lương");
}

export async function lockPayrollController(req: Request, res: Response) {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw new HttpError(400, "INVALID_PAYROLL_PERIOD_ID", "ID kỳ lương không hợp lệ");
  }

  const payroll = await payrollService.lockPeriod(id);
  return ok(res, payroll, "Đã khóa kỳ lương");
}

export async function exportPayrollTransferFileController(req: Request, res: Response) {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw new HttpError(400, "INVALID_PAYROLL_PERIOD_ID", "ID kỳ lương không hợp lệ");
  }

  const file = await payrollService.exportTransferFile(id);
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
  return res.send(file.buffer);
}
