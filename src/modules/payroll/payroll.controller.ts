import type { Request, Response } from "express";

import { ok } from "../../common/api-response";
import { HttpError } from "../../common/http-error";
import { PERMISSIONS } from "../../config/permissions";
import { PayrollService } from "./payroll.service";
import { PayrollRecordEditService } from "./payroll-record-edit.service";
import type { PayrollFormulaSettingDto, PayrollFormulaTemplateCreateDto, PayrollRecordUpdateDto } from "./payroll.dto";

const payrollService = new PayrollService();
const payrollRecordEditService = new PayrollRecordEditService();

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
  const settings = await payrollService.updateFormulaSetting(req.body, req.user);
  return ok(res, settings, "Đã cập nhật công thức bảng lương");
}

export async function listPayrollFormulaHistoryController(_req: Request, res: Response) {
  const history = await payrollService.listFormulaHistory();
  return ok(res, history);
}

export async function listPayrollRecordHistoryController(req: Request, res: Response) {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw new HttpError(400, "INVALID_PAYROLL_PERIOD_ID", "ID kỳ lương không hợp lệ");
  }

  const history = await payrollRecordEditService.listPeriodHistory(id);
  return ok(res, history);
}

export async function revertPayrollFormulaHistoryController(req: Request, res: Response) {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw new HttpError(400, "INVALID_PAYROLL_FORMULA_HISTORY_ID", "ID lịch sử công thức không hợp lệ");
  }

  const settings = await payrollService.revertFormulaHistory(id, req.user);
  return ok(res, settings, "Đã khôi phục công thức bảng lương");
}

export async function revertPayrollRecordHistoryController(req: Request, res: Response) {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw new HttpError(400, "INVALID_PAYROLL_RECORD_HISTORY_ID", "ID lịch sử bảng lương không hợp lệ");
  }

  const period = await payrollRecordEditService.revertHistory(id, req.user);
  const payroll = await payrollService.list(period);
  return ok(res, payroll, "Đã khôi phục lịch sử bảng lương");
}

export async function listPayrollFormulaTemplatesController(_req: Request, res: Response) {
  const templates = await payrollService.listFormulaTemplates();
  return ok(res, templates);
}

export async function createPayrollFormulaTemplateController(
  req: Request<unknown, unknown, PayrollFormulaTemplateCreateDto>,
  res: Response,
) {
  const template = await payrollService.createFormulaTemplate(req.body, req.user);
  return ok(res, template, "Đã lưu mẫu công thức");
}

export async function applyPayrollFormulaTemplateController(req: Request, res: Response) {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw new HttpError(400, "INVALID_PAYROLL_FORMULA_TEMPLATE_ID", "ID mẫu công thức không hợp lệ");
  }

  const settings = await payrollService.applyFormulaTemplate(id, req.user);
  return ok(res, settings, "Đã áp dụng mẫu công thức");
}

export async function lockPayrollController(req: Request, res: Response) {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw new HttpError(400, "INVALID_PAYROLL_PERIOD_ID", "ID kỳ lương không hợp lệ");
  }

  const payroll = await payrollService.lockPeriod(id);
  return ok(res, payroll, "Đã khóa kỳ lương");
}

export async function unlockPayrollController(req: Request, res: Response) {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw new HttpError(400, "INVALID_PAYROLL_PERIOD_ID", "ID kỳ lương không hợp lệ");
  }

  const payroll = await payrollService.unlockPeriod(id);
  return ok(res, payroll, "Đã mở khóa kỳ lương");
}

export async function updatePayrollRecordController(
  req: Request<{ id: string }, unknown, PayrollRecordUpdateDto>,
  res: Response,
) {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw new HttpError(400, "INVALID_SALARY_RECORD_ID", "ID dòng bảng lương không hợp lệ");
  }

  const period = await payrollRecordEditService.updateRecord(id, req.body, req.user);
  const payroll = await payrollService.list(period);
  return ok(res, payroll, "Đã cập nhật bảng lương");
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
