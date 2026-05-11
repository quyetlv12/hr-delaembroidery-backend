import type { Request, Response } from "express";

import { created, ok } from "../../common/api-response";
import { HttpError } from "../../common/http-error";
import { PERMISSIONS } from "../../config/permissions";
import { EmployeeService } from "./employee.service";

const employeeService = new EmployeeService();

export async function listEmployeesController(req: Request, res: Response) {
  const employeeScopeId = isEmployeeSelfService(req) ? req.user?.employeeId : undefined;
  const employees = await employeeService.list(employeeScopeId);
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

  const employee = await employeeService.update(id, req.body);
  return ok(res, employee, "Đã cập nhật nhân viên");
}

export async function deleteEmployeeController(req: Request, res: Response) {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw new HttpError(400, "INVALID_EMPLOYEE_ID", "ID nhân viên không hợp lệ");
  }

  const result = await employeeService.remove(id);
  return ok(res, result, "Đã xóa nhân viên");
}

function isEmployeeSelfService(req: Request) {
  return (
    Boolean(req.user?.employeeId) &&
    !req.user?.permissions.includes(PERMISSIONS.employeesUpdate) &&
    !req.user?.permissions.includes(PERMISSIONS.attendanceImport)
  );
}
