import type { Request, Response } from "express";

import { ok } from "../../common/api-response";
import { HttpError } from "../../common/http-error";
import { PERMISSIONS } from "../../config/permissions";
import { AttendanceService } from "./attendance.service";
import { resetAttendancePayrollPeriod } from "./attendance-reset.service";
import { AttendanceServerManualSyncService } from "./attendance-server-manual-sync.service";
import { AttendanceServerSettingsService } from "./attendance-server-settings.service";
import { AttendanceServerStaffService } from "./attendance-server-staff.service";
import { AttendanceServerSyncTestService } from "./attendance-server-sync-test.service";
import { attendanceServerSavedStaffListDto } from "./attendance.dto";
import type {
  AttendanceHolidaySettingsDto,
  AttendanceMonthSettingDto,
  AttendanceServerManualSyncDto,
  AttendanceServerBodyImportDto,
  AttendanceServerStaffListDto,
  AttendanceServerSettingsDto,
  AttendanceServerSyncTestDto,
  AttendanceSettingsDto,
  ResetAttendancePayrollDto,
  UpdateAttendanceSummariesDto,
} from "./attendance.dto";

const attendanceService = new AttendanceService();
const attendanceServerManualSyncService = new AttendanceServerManualSyncService();
const attendanceServerSettingsService = new AttendanceServerSettingsService();
const attendanceServerStaffService = new AttendanceServerStaffService();
const attendanceServerSyncTestService = new AttendanceServerSyncTestService();

export async function listAttendanceController(req: Request, res: Response) {
  const month = Number(req.query.month);
  const year = Number(req.query.year);
  if (!month || !year) {
    throw new HttpError(400, "INVALID_ATTENDANCE_PERIOD", "Vui lòng nhập tháng và năm");
  }

  const canViewAllAttendance = req.user?.permissions.includes(PERMISSIONS.attendanceImport);
  const employeeScopeId = canViewAllAttendance ? undefined : req.user?.employeeId;
  if (!employeeScopeId && !canViewAllAttendance) {
    throw new HttpError(403, "EMPLOYEE_PROFILE_REQUIRED", "Tài khoản chưa liên kết hồ sơ nhân viên");
  }

  const attendance = await attendanceService.list(month, year, employeeScopeId);
  return ok(res, attendance);
}

export async function getAttendanceSettingsController(_req: Request, res: Response) {
  const settings = await attendanceService.getSettings();
  return ok(res, settings);
}

export async function updateAttendanceSettingsController(
  req: Request<unknown, unknown, AttendanceSettingsDto>,
  res: Response,
) {
  const settings = await attendanceService.updateSettings(req.body);
  return ok(res, settings, "Đã cập nhật cấu hình chấm công");
}

export async function getAttendanceServerSettingsController(_req: Request, res: Response) {
  const settings = await attendanceServerSettingsService.getSettings();
  return ok(res, settings);
}

export async function updateAttendanceServerSettingsController(
  req: Request<unknown, unknown, AttendanceServerSettingsDto>,
  res: Response,
) {
  const settings = await attendanceServerSettingsService.updateSettings(req.body, req.user);
  return ok(res, settings, "Đã lưu cookie máy chấm công");
}

export async function listAttendanceMonthSettingsController(req: Request, res: Response) {
  const year = Number(req.query.year);
  if (!year) {
    throw new HttpError(400, "INVALID_ATTENDANCE_SETTINGS_YEAR", "Vui lòng nhập năm cấu hình");
  }

  const settings = await attendanceService.listMonthSettings(year);
  return ok(res, settings);
}

export async function updateAttendanceMonthSettingController(
  req: Request<unknown, unknown, AttendanceMonthSettingDto>,
  res: Response,
) {
  const settings = await attendanceService.updateMonthSetting(req.body);
  return ok(res, settings, "Đã cập nhật cấu hình công tháng");
}

export async function listAttendanceHolidaySettingsController(req: Request, res: Response) {
  const year = Number(req.query.year);
  if (!year) {
    throw new HttpError(400, "INVALID_HOLIDAY_SETTINGS_YEAR", "Vui lòng nhập năm cấu hình");
  }

  const settings = await attendanceService.listHolidaySettings(year);
  return ok(res, settings);
}

export async function updateAttendanceHolidaySettingsController(
  req: Request<unknown, unknown, AttendanceHolidaySettingsDto>,
  res: Response,
) {
  const settings = await attendanceService.updateHolidaySettings(req.body);
  return ok(res, settings, "Đã cập nhật ngày lễ");
}

export async function importAttendanceController(req: Request, res: Response) {
  if (!req.file) {
    throw new HttpError(400, "ATTENDANCE_FILE_REQUIRED", "Vui lòng chọn file chấm công");
  }

  const result = await attendanceService.importFile({
    file: req.file,
    month: req.body.month ? Number(req.body.month) : undefined,
    year: req.body.year ? Number(req.body.year) : undefined,
    autoCreateMissingEmployees: req.body.autoCreateMissingEmployees !== "false",
  });

  return ok(res, result, "Đã nhập chấm công và cập nhật tiền công");
}

export async function previewAttendanceImportController(req: Request, res: Response) {
  if (!req.file) {
    throw new HttpError(400, "ATTENDANCE_FILE_REQUIRED", "Vui lòng chọn file chấm công");
  }

  const preview = await attendanceService.previewFile({
    file: req.file,
    month: req.body.month ? Number(req.body.month) : undefined,
    year: req.body.year ? Number(req.body.year) : undefined,
  });

  return ok(res, preview, "Đã tạo preview chấm công");
}

export async function confirmAttendanceImportController(req: Request, res: Response) {
  const result = await attendanceService.confirmImport(req.body);
  return ok(res, result, "Đã nhập chấm công và cập nhật tiền công");
}

export async function resetAttendancePayrollController(
  req: Request<unknown, unknown, ResetAttendancePayrollDto>,
  res: Response,
) {
  const result = await resetAttendancePayrollPeriod(req.body);
  return ok(res, result, "Đã reset chấm công và bảng lương, giữ nguyên thưởng theo kỳ");
}

export async function updateAttendanceSummariesController(
  req: Request<unknown, unknown, UpdateAttendanceSummariesDto>,
  res: Response,
) {
  const result = await attendanceService.updateSummaries(req.body);
  return ok(res, result, "Đã cập nhật giờ chấm công");
}

export async function testAttendanceServerSyncController(
  req: Request<unknown, unknown, AttendanceServerSyncTestDto>,
  res: Response,
) {
  const result = await attendanceServerSyncTestService.test(req.body);
  return ok(res, result, "Đã gọi thử API máy chấm công, chưa lưu dữ liệu");
}

export async function importAttendanceServerBodyController(
  req: Request<unknown, unknown, AttendanceServerBodyImportDto>,
  res: Response,
) {
  const result = await attendanceService.importServerBody(req.body);
  return ok(res, result, "Đã nhập body máy chấm công vào bảng chấm công");
}

export async function manualSyncAttendanceServerController(
  req: Request<unknown, unknown, AttendanceServerManualSyncDto>,
  res: Response,
) {
  const result = await attendanceServerManualSyncService.sync(req.body);
  return ok(res, result, "Đã đồng bộ thủ công dữ liệu từ máy chấm công");
}

export async function listAttendanceServerStaffController(
  req: Request<unknown, unknown, AttendanceServerStaffListDto>,
  res: Response,
) {
  const result = await attendanceServerSyncTestService.listStaff(req.body);
  return ok(res, result, "Đã tải danh sách nhân viên từ máy chấm công");
}

export async function listSavedAttendanceServerStaffController(req: Request, res: Response) {
  const query = attendanceServerSavedStaffListDto.parse(req.query);
  const result = await attendanceServerStaffService.list(query);
  return ok(res, result);
}

export async function syncAttendanceServerStaffController(
  req: Request<unknown, unknown, AttendanceServerStaffListDto>,
  res: Response,
) {
  const result = await attendanceServerStaffService.sync(req.body, req.user);
  return ok(res, result, `Đã lưu ${result.savedRows} nhân viên máy chấm công`);
}
