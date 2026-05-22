import type { Request, Response } from "express";

import { ok } from "../../common/api-response";
import { EmailSettingsService } from "./email-settings.service";
import type { EmailSettingsDto, EmailTestDto } from "./email-settings.dto";

const emailSettingsService = new EmailSettingsService();

export async function getEmailSettingsController(_req: Request, res: Response) {
  const settings = await emailSettingsService.getSettings();
  return ok(res, settings);
}

export async function updateEmailSettingsController(
  req: Request<unknown, unknown, EmailSettingsDto>,
  res: Response,
) {
  const settings = await emailSettingsService.updateSettings(req.body, req.user);
  return ok(res, settings, "Đã lưu cấu hình email");
}

export async function testEmailSettingsController(
  req: Request<unknown, unknown, EmailTestDto>,
  res: Response,
) {
  const result = await emailSettingsService.sendTestEmail(req.body);
  return ok(res, result, "Đã gửi email test");
}
