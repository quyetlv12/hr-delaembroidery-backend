import { Router } from "express";

import { validateBody } from "../../common/validate";
import { PERMISSIONS } from "../../config/permissions";
import { authGuard } from "../../guards/auth.guard";
import { permissionGuard } from "../../guards/permission.guard";
import {
  getEmailSettingsController,
  testEmailSettingsController,
  updateEmailSettingsController,
} from "./email-settings.controller";
import { emailSettingsDto, emailTestDto } from "./email-settings.dto";

export const emailSettingsRoutes = Router();

emailSettingsRoutes.use(authGuard);
emailSettingsRoutes.get("/", permissionGuard(PERMISSIONS.payslipEmailSend), getEmailSettingsController);
emailSettingsRoutes.put(
  "/",
  permissionGuard(PERMISSIONS.payslipEmailSend),
  validateBody(emailSettingsDto),
  updateEmailSettingsController,
);
emailSettingsRoutes.post(
  "/test",
  permissionGuard(PERMISSIONS.payslipEmailSend),
  validateBody(emailTestDto),
  testEmailSettingsController,
);
