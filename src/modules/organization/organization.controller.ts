import type { Request, Response } from "express";

import { created, ok } from "../../common/api-response";
import { HttpError } from "../../common/http-error";
import { OrganizationService } from "./organization.service";

const organizationService = new OrganizationService();

export async function listDepartmentsController(_req: Request, res: Response) {
  const departments = await organizationService.listDepartments();
  return ok(res, departments);
}

export async function getDepartmentController(req: Request, res: Response) {
  const id = getIdParam(req);
  const department = await organizationService.getDepartment(id);
  return ok(res, department);
}

export async function createDepartmentController(req: Request, res: Response) {
  const department = await organizationService.createDepartment(req.body);
  return created(res, department, "Đã tạo phòng ban");
}

export async function updateDepartmentController(req: Request, res: Response) {
  const id = getIdParam(req);
  const department = await organizationService.updateDepartment(id, req.body);
  return ok(res, department, "Đã cập nhật phòng ban");
}

export async function deleteDepartmentController(req: Request, res: Response) {
  const id = getIdParam(req);
  const result = await organizationService.deleteDepartment(id);
  return ok(res, result, "Đã xóa phòng ban");
}

export async function listPositionsController(_req: Request, res: Response) {
  const positions = await organizationService.listPositions();
  return ok(res, positions);
}

export async function getPositionController(req: Request, res: Response) {
  const id = getIdParam(req);
  const position = await organizationService.getPosition(id);
  return ok(res, position);
}

export async function createPositionController(req: Request, res: Response) {
  const position = await organizationService.createPosition(req.body);
  return created(res, position, "Đã tạo chức vụ");
}

export async function updatePositionController(req: Request, res: Response) {
  const id = getIdParam(req);
  const position = await organizationService.updatePosition(id, req.body);
  return ok(res, position, "Đã cập nhật chức vụ");
}

export async function deletePositionController(req: Request, res: Response) {
  const id = getIdParam(req);
  const result = await organizationService.deletePosition(id);
  return ok(res, result, "Đã xóa chức vụ");
}

function getIdParam(req: Request) {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw new HttpError(400, "INVALID_ORGANIZATION_ID", "ID không hợp lệ");
  }

  return id;
}
