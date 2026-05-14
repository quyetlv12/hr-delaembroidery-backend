import type { Request, Response } from "express";

import { ok } from "../../common/api-response";
import { EmployeeViewSettingsService } from "./employee-view-settings.service";
import type { EmployeeViewSettingsDto } from "./employee-view-settings.dto";

const employeeViewSettingsService = new EmployeeViewSettingsService();

export async function getEmployeeViewSettingsController(_req: Request, res: Response) {
  const settings = await employeeViewSettingsService.getSettings();
  return ok(res, settings);
}

export async function updateEmployeeViewSettingsController(
  req: Request<unknown, unknown, EmployeeViewSettingsDto>,
  res: Response,
) {
  const settings = await employeeViewSettingsService.updateSettings(req.body);
  return ok(res, settings, "Đã cập nhật cột nhân viên được xem");
}
