import { z } from "zod";

const optionalTime = z.preprocess(
  (value) => (value === "" ? null : value),
  z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .optional(),
);

export const updateAttendanceSummariesDto = z.object({
  rows: z
    .array(
      z.object({
        id: z.string().uuid(),
        morningCheckIn: optionalTime,
        morningCheckOut: optionalTime,
        afternoonCheckIn: optionalTime,
        afternoonCheckOut: optionalTime,
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
  overtimeRate: z.coerce
    .number()
    .min(0, "Hệ số lương OT phải lớn hơn hoặc bằng 0")
    .max(10, "Hệ số lương OT không được vượt quá 10"),
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

export type UpdateAttendanceSummariesDto = z.infer<typeof updateAttendanceSummariesDto>;
export type UpdateAttendanceSummaryRowDto = UpdateAttendanceSummariesDto["rows"][number];
export type AttendanceSettingsDto = z.infer<typeof attendanceSettingsDto>;
export type AttendanceMonthSettingDto = z.infer<typeof attendanceMonthSettingDto>;
