import { z } from "zod";

const optionalTime = z.preprocess(
  (value) => (value === "" ? null : value),
  z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .optional(),
);

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có định dạng YYYY-MM-DD");

export const updateAttendanceSummariesDto = z.object({
  rows: z
    .array(
      z
        .object({
          id: z.string().uuid().optional(),
          employeeId: z.string().uuid().optional(),
          workDate: dateOnly.optional(),
          morningCheckIn: optionalTime,
          morningCheckOut: optionalTime,
          afternoonCheckIn: optionalTime,
          afternoonCheckOut: optionalTime,
          nightCheckIn: optionalTime,
          nightCheckOut: optionalTime,
        })
        .refine((row) => row.id || (row.employeeId && row.workDate), {
          message: "Cần id dòng chấm công hoặc employeeId + workDate để tạo mới",
        }),
    )
    .min(1),
});

const timeSetting = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Giờ phải có định dạng HH:mm");

export const attendanceSettingsDto = z.object({
  morningStart: timeSetting,
  morningEnd: timeSetting,
  afternoonStart: timeSetting,
  afternoonEnd: timeSetting,
  nightStart: timeSetting,
  nightEnd: timeSetting,
  overtimeRate: z.coerce
    .number()
    .min(0, "Hệ số lương OT phải lớn hơn hoặc bằng 0")
    .max(10, "Hệ số lương OT không được vượt quá 10"),
  holidayRate: z.coerce
    .number()
    .min(0, "Hệ số lương ngày lễ phải lớn hơn hoặc bằng 0")
    .max(10, "Hệ số lương ngày lễ không được vượt quá 10"),
  weeklyDaysOff: z
    .array(z.coerce.number().int().min(0, "Thứ nghỉ không hợp lệ").max(6, "Thứ nghỉ không hợp lệ"))
    .max(7, "Số ngày nghỉ hằng tuần không hợp lệ")
    .optional()
    .default([0]),
});

export const attendanceMonthSettingDto = z.object({
  month: z.coerce.number().int().min(1, "Tháng phải từ 1 đến 12").max(12, "Tháng phải từ 1 đến 12"),
  year: z.coerce.number().int().min(2000, "Năm không hợp lệ").max(2100, "Năm không hợp lệ"),
  standardWorkDay: z.coerce
    .number()
    .min(0, "Số công chuẩn phải lớn hơn hoặc bằng 0")
    .max(31, "Số công chuẩn không được vượt quá 31"),
  holidayPaidDays: z.coerce
    .number()
    .min(0, "Số ngày nghỉ lễ phải lớn hơn hoặc bằng 0")
    .max(31, "Số ngày nghỉ lễ không được vượt quá 31"),
  holidayBonusAmount: z.coerce
    .number()
    .min(0, "Tiền cộng ngày lễ phải lớn hơn hoặc bằng 0")
    .max(1_000_000_000, "Tiền cộng ngày lễ quá lớn"),
});

const holidayBonusAmount = z.coerce
  .number()
  .min(0, "Tiền ngày lễ phải lớn hơn hoặc bằng 0")
  .max(1_000_000_000, "Tiền ngày lễ quá lớn");

const holidayInput = z.object({
  date: dateOnly,
  name: z.string().trim().max(150, "Tên ngày lễ quá dài").optional(),
  isPaid: z.coerce.boolean().optional().default(true),
  amount: holidayBonusAmount.default(0),
});

export const attendanceHolidaySettingsDto = z
  .object({
    year: z.coerce.number().int().min(2000, "Năm không hợp lệ").max(2100, "Năm không hợp lệ"),
    dates: z.array(dateOnly).max(366, "Số ngày lễ quá lớn").optional(),
    holidays: z.array(holidayInput).max(366, "Số ngày lễ quá lớn").optional(),
  })
  .refine((value) => value.dates !== undefined || value.holidays !== undefined, {
    message: "Vui lòng chọn ngày lễ",
    path: ["holidays"],
  });

export const resetAttendancePayrollDto = z.object({
  month: z.coerce.number().int().min(1, "Tháng phải từ 1 đến 12").max(12, "Tháng phải từ 1 đến 12"),
  year: z.coerce.number().int().min(2000, "Năm không hợp lệ").max(2100, "Năm không hợp lệ"),
});

export const attendanceServerSyncTestDto = z.object({
  endpoint: z
    .string()
    .url("Endpoint không hợp lệ")
    .default("https://global.yunatt.com/cardRecord/queryForMonth"),
  cookie: z
    .preprocess((value) => (value === "" || value === null ? undefined : value), z.string().trim().min(10).optional()),
  monthDataId: z.string().trim().min(1, "Vui lòng nhập monthDataId"),
  order: z.enum(["asc", "desc"]).default("asc"),
  offset: z.coerce.number().int().min(0, "Offset phải lớn hơn hoặc bằng 0").default(0),
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit phải lớn hơn 0")
    .max(200, "Limit test không được vượt quá 200 dòng")
    .default(15),
  search: z.string().max(200, "Từ khóa tìm kiếm quá dài").default(""),
});

export const attendanceServerStaffListDto = z.object({
  endpoint: z.string().url("Endpoint không hợp lệ").default("https://global.yunatt.com/staff/query"),
  cookie: z
    .preprocess((value) => (value === "" || value === null ? undefined : value), z.string().trim().min(10).optional()),
  sort: z.string().trim().min(1).max(80).default("staff_number"),
  order: z.enum(["asc", "desc"]).default("asc"),
  offset: z.coerce.number().int().min(0, "Offset phải lớn hơn hoặc bằng 0").default(0),
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit phải lớn hơn 0")
    .max(200, "Limit test không được vượt quá 200 dòng")
    .default(15),
  search: z.string().max(200, "Từ khóa tìm kiếm quá dài").default(""),
});

export const attendanceServerSavedStaffListDto = z.object({
  offset: z.coerce.number().int().min(0, "Offset phải lớn hơn hoặc bằng 0").default(0),
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit phải lớn hơn 0")
    .max(200, "Limit không được vượt quá 200 dòng")
    .default(50),
  search: z.string().max(200, "Từ khóa tìm kiếm quá dài").default(""),
});

export const attendanceServerBodyImportDto = z.object({
  month: z.coerce.number().int().min(1, "Tháng phải từ 1 đến 12").max(12, "Tháng phải từ 1 đến 12"),
  year: z.coerce.number().int().min(2000, "Năm không hợp lệ").max(2100, "Năm không hợp lệ"),
  fileName: z.string().trim().max(120, "Tên nguồn quá dài").optional(),
  body: z.any().refine((value) => value !== null && value !== undefined, "Vui lòng nhập body JSON từ admin"),
});

export const attendanceServerManualSyncDto = z.object({
  monthDataId: z.string().trim().min(1, "Vui lòng chọn monthDataId trên máy chấm công").max(60),
  sourcePeriod: z.string().trim().regex(/^\d{4}-\d{2}$/, "Kỳ nguồn phải có dạng YYYY-MM").optional(),
  month: z.coerce.number().int().min(1, "Tháng phải từ 1 đến 12").max(12, "Tháng phải từ 1 đến 12"),
  year: z.coerce.number().int().min(2000, "Năm không hợp lệ").max(2100, "Năm không hợp lệ"),
});

export const attendanceServerSettingsDto = z.object({
  attendanceEndpoint: z
    .string()
    .url("Endpoint chấm công không hợp lệ")
    .default("https://global.yunatt.com/cardRecord/queryForMonth"),
  staffEndpoint: z.string().url("Endpoint danh sách staff không hợp lệ").default("https://global.yunatt.com/staff/query"),
  cookie: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.string().trim().min(10, "Vui lòng nhập cookie phiên đăng nhập máy chấm công").optional(),
  ),
  autoSyncEnabled: z.coerce.boolean().optional(),
  autoSyncMonthDataId: z.string().trim().max(60, "Mã kỳ Yunatt quá dài").optional(),
  autoSyncMonthMappings: z
    .array(
      z.object({
        period: z.string().trim().regex(/^\d{4}-\d{2}$/, "Kỳ máy chấm công phải có dạng YYYY-MM"),
        monthDataId: z.string().trim().min(1, "Vui lòng nhập monthDataId").max(60, "Mã kỳ Yunatt quá dài"),
      }),
    )
    .max(60, "Danh sách tháng máy chấm công quá dài")
    .optional(),
  autoSyncShiftWindows: z
    .array(
      z.object({
        key: z.enum(["morning", "afternoon", "night"]),
        enabled: z.coerce.boolean().default(true),
        startTime: timeSetting,
        endTime: timeSetting,
        intervalMinutes: z.coerce
          .number()
          .int("Chu kỳ đồng bộ phải là số nguyên")
          .min(1, "Chu kỳ đồng bộ phải lớn hơn 0")
          .max(120, "Chu kỳ đồng bộ quá lớn"),
      }),
    )
    .max(3, "Chỉ cấu hình tối đa 3 ca đồng bộ")
    .optional(),
  autoSyncStartOffsetMinutes: z.coerce
    .number()
    .int("Thời gian bắt đầu đồng bộ phải là số nguyên")
    .min(0, "Thời gian bắt đầu đồng bộ phải lớn hơn hoặc bằng 0")
    .max(720, "Thời gian bắt đầu đồng bộ quá lớn")
    .optional(),
  autoSyncWindowMinutes: z.coerce
    .number()
    .int("Thời gian tự tắt đồng bộ phải là số nguyên")
    .min(1, "Thời gian tự tắt đồng bộ phải lớn hơn 0")
    .max(720, "Thời gian tự tắt đồng bộ quá lớn")
    .optional(),
  autoSyncIntervalMinutes: z.coerce
    .number()
    .int("Chu kỳ đồng bộ phải là số nguyên")
    .min(1, "Chu kỳ đồng bộ phải lớn hơn 0")
    .max(120, "Chu kỳ đồng bộ quá lớn")
    .optional(),
});

export type UpdateAttendanceSummariesDto = z.infer<typeof updateAttendanceSummariesDto>;
export type UpdateAttendanceSummaryRowDto = UpdateAttendanceSummariesDto["rows"][number];
export type AttendanceSettingsDto = z.infer<typeof attendanceSettingsDto>;
export type AttendanceMonthSettingDto = z.infer<typeof attendanceMonthSettingDto>;
export type AttendanceHolidaySettingsDto = z.infer<typeof attendanceHolidaySettingsDto>;
export type ResetAttendancePayrollDto = z.infer<typeof resetAttendancePayrollDto>;
export type AttendanceServerSyncTestDto = z.infer<typeof attendanceServerSyncTestDto>;
export type AttendanceServerStaffListDto = z.infer<typeof attendanceServerStaffListDto>;
export type AttendanceServerSavedStaffListDto = z.infer<typeof attendanceServerSavedStaffListDto>;
export type AttendanceServerBodyImportDto = z.infer<typeof attendanceServerBodyImportDto>;
export type AttendanceServerManualSyncDto = z.infer<typeof attendanceServerManualSyncDto>;
export type AttendanceServerSettingsDto = z.infer<typeof attendanceServerSettingsDto>;
