import type { Request, Response } from "express";

import { created, ok } from "../../common/api-response";
import { HttpError } from "../../common/http-error";
import { PERMISSIONS } from "../../config/permissions";
import { EmployeeService } from "./employee.service";

const employeeService = new EmployeeService();

export async function listEmployeesController(req: Request, res: Response) {
  const employeeScopeId = isEmployeeSelfService(req) ? req.user?.employeeId : undefined;
  const employees = await employeeService.list(employeeScopeId, getBonusPeriodQuery(req));
  return ok(res, employees);
}

export async function listEmployeeFormOptionsController(req: Request, res: Response) {
  if (isEmployeeSelfService(req)) {
    throw new HttpError(403, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này");
  }

  const options = await employeeService.formOptions();
  return ok(res, options);
}

export async function getEmployeeController(req: Request, res: Response) {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw new HttpError(400, "INVALID_EMPLOYEE_ID", "ID nhân viên không hợp lệ");
  }

  if (isEmployeeSelfService(req) && id !== req.user?.employeeId) {
    throw new HttpError(403, "FORBIDDEN", "Bạn chỉ được xem hồ sơ của chính mình");
  }

  const employee = await employeeService.detail(id);
  return ok(res, employee);
}

export async function createEmployeeController(req: Request, res: Response) {
  const employee = await employeeService.create(req.body);
  return created(res, employee, "Đã tạo nhân viên");
}

export async function updateEmployeeController(req: Request, res: Response) {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw new HttpError(400, "INVALID_EMPLOYEE_ID", "ID nhân viên không hợp lệ");
  }

  const employee = await employeeService.update(id, req.body, getRequestActor(req));
  return ok(res, employee, "Đã cập nhật nhân viên");
}

export async function updateEmployeeSalaryController(req: Request, res: Response) {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw new HttpError(400, "INVALID_EMPLOYEE_ID", "ID nhân viên không hợp lệ");
  }

  const employee = await employeeService.updateSalary(id, req.body, getRequestActor(req));
  return ok(res, employee, "Đã cập nhật lương nhân viên");
}

export async function updateEmployeeTimekeepingCodeController(req: Request, res: Response) {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw new HttpError(400, "INVALID_EMPLOYEE_ID", "ID nhân viên không hợp lệ");
  }

  const employee = await employeeService.updateTimekeepingCode(id, req.body);
  return ok(res, employee, "Đã cập nhật ID máy chấm công");
}

export async function updateEmployeeMonthlyBonusController(req: Request, res: Response) {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw new HttpError(400, "INVALID_EMPLOYEE_ID", "ID nhân viên không hợp lệ");
  }

  const employee = await employeeService.updateMonthlyBonus(id, req.body, getRequestActor(req));
  return ok(res, employee, "Đã cập nhật thưởng tháng");
}

export async function increaseEmployeeSalariesController(req: Request, res: Response) {
  const result = await employeeService.increaseSalaries(req.body, getRequestActor(req));
  return ok(res, result, `Đã tăng lương ${result.updated} nhân viên`);
}

export async function deleteEmployeeController(req: Request, res: Response) {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw new HttpError(400, "INVALID_EMPLOYEE_ID", "ID nhân viên không hợp lệ");
  }

  const result = await employeeService.remove(id);
  return ok(res, result, "Đã xóa nhân viên");
}

export async function listEmployeeDocumentsController(req: Request, res: Response) {
  const employeeId = getEmployeeIdParam(req);
  assertCanAccessEmployee(req, employeeId);
  const documents = await employeeService.listDocuments(employeeId);
  return ok(res, documents);
}

export async function listEmployeeSalaryHistoryController(req: Request, res: Response) {
  const employeeId = getEmployeeIdParam(req);
  assertCanAccessEmployee(req, employeeId);
  const histories = await employeeService.listSalaryHistory(employeeId);
  return ok(res, histories);
}

export async function listEmployeeMonthlyBonusHistoryController(req: Request, res: Response) {
  const employeeId = getEmployeeIdParam(req);
  assertCanAccessEmployee(req, employeeId);
  const histories = await employeeService.listMonthlyBonusHistory(employeeId);
  return ok(res, histories);
}

export async function listEmployeeSalaryHistoriesController(req: Request, res: Response) {
  const employeeScopeId = isEmployeeSelfService(req) ? req.user?.employeeId : undefined;
  const histories = await employeeService.listSalaryHistories(employeeScopeId);
  return ok(res, histories);
}

export async function uploadEmployeeDocumentsController(req: Request, res: Response) {
  const employeeId = getEmployeeIdParam(req);
  const files = Array.isArray(req.files) ? req.files : [];
  const documents = await employeeService.uploadDocuments(employeeId, files);
  return created(res, documents, "Đã tải file nhân viên");
}

export async function downloadEmployeeDocumentController(req: Request, res: Response) {
  const employeeId = getEmployeeIdParam(req);
  assertCanAccessEmployee(req, employeeId);
  const documentId = getDocumentIdParam(req);
  const document = await employeeService.getDocumentForDownload(employeeId, documentId);
  res.download(document.path, document.fileName, {
    headers: {
      "Content-Type": document.mimeType,
    },
  });
}

export async function deleteEmployeeDocumentController(req: Request, res: Response) {
  const employeeId = getEmployeeIdParam(req);
  const documentId = getDocumentIdParam(req);
  const result = await employeeService.deleteDocument(employeeId, documentId);
  return ok(res, result, "Đã xóa file nhân viên");
}

export async function uploadEmployeeAvatarController(req: Request, res: Response) {
  const employeeId = getEmployeeIdParam(req);
  const employee = await employeeService.uploadAvatar(employeeId, req.file);
  return ok(res, employee, "Đã cập nhật ảnh đại diện");
}

export async function deleteEmployeeAvatarController(req: Request, res: Response) {
  const employeeId = getEmployeeIdParam(req);
  const employee = await employeeService.deleteAvatar(employeeId);
  return ok(res, employee, "Đã xóa ảnh đại diện");
}

function getEmployeeIdParam(req: Request) {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw new HttpError(400, "INVALID_EMPLOYEE_ID", "ID nhân viên không hợp lệ");
  }
  return id;
}

function getDocumentIdParam(req: Request) {
  const documentId = req.params.documentId;
  if (typeof documentId !== "string") {
    throw new HttpError(400, "INVALID_EMPLOYEE_DOCUMENT_ID", "ID file không hợp lệ");
  }
  return documentId;
}

function getBonusPeriodQuery(req: Request) {
  const month = Number(req.query.bonusMonth);
  const year = Number(req.query.bonusYear);
  const hasMonth = req.query.bonusMonth !== undefined;
  const hasYear = req.query.bonusYear !== undefined;
  if (!hasMonth && !hasYear) {
    return {};
  }
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new HttpError(400, "INVALID_BONUS_PERIOD", "Kỳ thưởng không hợp lệ");
  }
  return {
    bonusMonth: month,
    bonusYear: year,
  };
}

function isEmployeeSelfService(req: Request) {
  return (
    Boolean(req.user?.employeeId) &&
    !req.user?.permissions.includes(PERMISSIONS.employeesUpdate) &&
    !req.user?.permissions.includes(PERMISSIONS.attendanceImport)
  );
}

function assertCanAccessEmployee(req: Request, employeeId: string) {
  if (isEmployeeSelfService(req) && employeeId !== req.user?.employeeId) {
    throw new HttpError(403, "FORBIDDEN", "Bạn chỉ được xem hồ sơ của chính mình");
  }
}

function getRequestActor(req: Request) {
  return req.user
    ? {
        id: req.user.id,
        loginCode: req.user.loginCode,
      }
    : undefined;
}
