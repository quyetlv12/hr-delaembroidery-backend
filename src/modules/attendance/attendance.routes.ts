import { Router } from "express";
import multer from "multer";

import { PERMISSIONS } from "../../config/permissions";
import { validateBody } from "../../common/validate";
import { authGuard } from "../../guards/auth.guard";
import { permissionGuard } from "../../guards/permission.guard";
import {
  confirmAttendanceImportController,
  getAttendanceServerSettingsController,
  getAttendanceSettingsController,
  importAttendanceController,
  importAttendanceServerBodyController,
  listAttendanceHolidaySettingsController,
  listAttendanceMonthSettingsController,
  listAttendanceServerStaffController,
  listSavedAttendanceServerStaffController,
  listAttendanceController,
  manualSyncAttendanceServerController,
  previewAttendanceImportController,
  resetAttendancePayrollController,
  syncAttendanceServerStaffController,
  testAttendanceServerSyncController,
  updateAttendanceServerSettingsController,
  updateAttendanceHolidaySettingsController,
  updateAttendanceMonthSettingController,
  updateAttendanceSettingsController,
  updateAttendanceSummariesController,
} from "./attendance.controller";
import {
  attendanceHolidaySettingsDto,
  attendanceMonthSettingDto,
  attendanceServerBodyImportDto,
  attendanceServerManualSyncDto,
  attendanceServerStaffListDto,
  attendanceServerSettingsDto,
  attendanceServerSyncTestDto,
  attendanceSettingsDto,
  resetAttendancePayrollDto,
  updateAttendanceSummariesDto,
} from "./attendance.dto";

export const attendanceRoutes = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

attendanceRoutes.use(authGuard);
attendanceRoutes.get(
  "/settings/holidays",
  permissionGuard(PERMISSIONS.attendanceRead),
  listAttendanceHolidaySettingsController,
);
attendanceRoutes.put(
  "/settings/holidays",
  permissionGuard(PERMISSIONS.attendanceImport),
  validateBody(attendanceHolidaySettingsDto),
  updateAttendanceHolidaySettingsController,
);
attendanceRoutes.get(
  "/settings/monthly",
  permissionGuard(PERMISSIONS.attendanceRead),
  listAttendanceMonthSettingsController,
);
attendanceRoutes.put(
  "/settings/monthly",
  permissionGuard(PERMISSIONS.attendanceImport),
  validateBody(attendanceMonthSettingDto),
  updateAttendanceMonthSettingController,
);
attendanceRoutes.get("/settings", permissionGuard(PERMISSIONS.attendanceRead), getAttendanceSettingsController);
attendanceRoutes.put(
  "/settings",
  permissionGuard(PERMISSIONS.attendanceImport),
  validateBody(attendanceSettingsDto),
  updateAttendanceSettingsController,
);
attendanceRoutes.get(
  "/server-sync/settings",
  permissionGuard(PERMISSIONS.attendanceImport),
  getAttendanceServerSettingsController,
);
attendanceRoutes.put(
  "/server-sync/settings",
  permissionGuard(PERMISSIONS.attendanceImport),
  validateBody(attendanceServerSettingsDto),
  updateAttendanceServerSettingsController,
);
attendanceRoutes.post(
  "/server-sync/test",
  permissionGuard(PERMISSIONS.attendanceImport),
  validateBody(attendanceServerSyncTestDto),
  testAttendanceServerSyncController,
);
attendanceRoutes.post(
  "/server-sync/import-body",
  permissionGuard(PERMISSIONS.attendanceImport),
  validateBody(attendanceServerBodyImportDto),
  importAttendanceServerBodyController,
);
attendanceRoutes.post(
  "/server-sync/manual",
  permissionGuard(PERMISSIONS.attendanceImport),
  validateBody(attendanceServerManualSyncDto),
  manualSyncAttendanceServerController,
);
attendanceRoutes.get(
  "/server-sync/staff/saved",
  permissionGuard(PERMISSIONS.attendanceImport),
  listSavedAttendanceServerStaffController,
);
attendanceRoutes.post(
  "/server-sync/staff/sync",
  permissionGuard(PERMISSIONS.attendanceImport),
  validateBody(attendanceServerStaffListDto),
  syncAttendanceServerStaffController,
);
attendanceRoutes.post(
  "/server-sync/staff",
  permissionGuard(PERMISSIONS.attendanceImport),
  validateBody(attendanceServerStaffListDto),
  listAttendanceServerStaffController,
);
attendanceRoutes.get("/", permissionGuard(PERMISSIONS.attendanceRead), listAttendanceController);
attendanceRoutes.put(
  "/summary",
  permissionGuard(PERMISSIONS.attendanceImport),
  validateBody(updateAttendanceSummariesDto),
  updateAttendanceSummariesController,
);
attendanceRoutes.post(
  "/import/preview",
  permissionGuard(PERMISSIONS.attendanceImport),
  upload.single("file"),
  previewAttendanceImportController,
);
attendanceRoutes.post(
  "/import/confirm",
  permissionGuard(PERMISSIONS.attendanceImport),
  confirmAttendanceImportController,
);
attendanceRoutes.post(
  "/reset-period",
  permissionGuard(PERMISSIONS.attendanceImport),
  validateBody(resetAttendancePayrollDto),
  resetAttendancePayrollController,
);
attendanceRoutes.post(
  "/import",
  permissionGuard(PERMISSIONS.attendanceImport),
  upload.single("file"),
  importAttendanceController,
);
