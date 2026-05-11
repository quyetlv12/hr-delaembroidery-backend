import type { Request, Response } from "express";

import { created, ok } from "../../common/api-response";
import { HttpError } from "../../common/http-error";
import { RolesPermissionsService } from "./roles-permissions.service";

const rolesPermissionsService = new RolesPermissionsService();

export async function listRolesController(_req: Request, res: Response) {
  const roles = await rolesPermissionsService.listRoles();
  return ok(res, roles);
}

export async function listRoleFormOptionsController(_req: Request, res: Response) {
  const options = await rolesPermissionsService.formOptions();
  return ok(res, options);
}

export async function getRoleController(req: Request, res: Response) {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw new HttpError(400, "INVALID_ROLE_ID", "ID vai trò không hợp lệ");
  }

  const role = await rolesPermissionsService.detail(id);
  return ok(res, role);
}

export async function createRoleController(req: Request, res: Response) {
  const role = await rolesPermissionsService.create(req.body);
  return created(res, role, "Đã tạo vai trò");
}

export async function updateRoleController(req: Request, res: Response) {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw new HttpError(400, "INVALID_ROLE_ID", "ID vai trò không hợp lệ");
  }

  const role = await rolesPermissionsService.update(id, req.body);
  return ok(res, role, "Đã cập nhật vai trò");
}

export async function deleteRoleController(req: Request, res: Response) {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw new HttpError(400, "INVALID_ROLE_ID", "ID vai trò không hợp lệ");
  }

  const result = await rolesPermissionsService.remove(id);
  return ok(res, result, "Đã xóa vai trò");
}
