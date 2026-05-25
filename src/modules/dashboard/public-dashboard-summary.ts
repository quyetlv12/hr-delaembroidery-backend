import { formatVietnamTime, getVietnamDateParts } from "../../common/vietnam-time";
import type { AttendanceSummary } from "../../entities";

export type CurrentMonthRange = { month: string; from: string; to: string };
export type MonthlyAttendanceTotals = { lateMinutes: number; earlyLeaveMinutes: number };

type PublicDashboardAttendanceSettings = {
  morningStart: string;
  afternoonStart: string;
  nightStart: string;
};

type PublicLateShift = {
  key: "morning" | "afternoon" | "night";
  label: string;
  plannedStart: string;
  checkInAt: string;
  lateMinutes: number;
};

type PublicLateEmployeeSource = {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  avatarUrl: string | null;
  departmentName: string;
  positionName: string;
  lateMinutes: number;
  firstCheckInAt: string | null;
  lateShifts: PublicLateShift[];
};

export function toPublicLateEmployee(employee: PublicLateEmployeeSource, monthlyTotals?: MonthlyAttendanceTotals) {
  const monthlyLateMinutes = monthlyTotals?.lateMinutes ?? 0;
  const monthlyEarlyLeaveMinutes = monthlyTotals?.earlyLeaveMinutes ?? 0;
  const monthlyEarlyLateMinutes = monthlyLateMinutes + monthlyEarlyLeaveMinutes;

  return {
    employeeId: employee.employeeId,
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    avatarUrl: employee.avatarUrl,
    departmentName: employee.departmentName,
    positionName: employee.positionName,
    lateMinutes: employee.lateMinutes,
    checkInAt: employee.firstCheckInAt,
    lateShifts: employee.lateShifts,
    monthlyLateMinutes,
    monthlyEarlyLeaveMinutes,
    monthlyEarlyLateMinutes,
    monthlyLateHours: minutesToHours(monthlyLateMinutes),
    monthlyEarlyLeaveHours: minutesToHours(monthlyEarlyLeaveMinutes),
    monthlyEarlyLateHours: minutesToHours(monthlyEarlyLateMinutes),
  };
}

export function buildPublicLateShifts(
  summary: AttendanceSummary,
  settings: PublicDashboardAttendanceSettings,
): PublicLateShift[] {
  return [
    {
      key: "morning" as const,
      label: "Ca sáng",
      plannedStart: settings.morningStart,
      checkInAt: formatVietnamTime(summary.morningCheckInAt),
    },
    {
      key: "afternoon" as const,
      label: "Ca chiều",
      plannedStart: settings.afternoonStart,
      checkInAt: formatVietnamTime(summary.afternoonCheckInAt),
    },
    {
      key: "night" as const,
      label: "Ca 3",
      plannedStart: settings.nightStart,
      checkInAt: formatVietnamTime(summary.nightCheckInAt),
    },
  ].flatMap((shift) => {
    const lateMinutes = calculateShiftLateMinutes(shift.checkInAt, shift.plannedStart);
    if (lateMinutes <= 0 || !shift.checkInAt) {
      return [];
    }

    return [
      {
        ...shift,
        checkInAt: shift.checkInAt,
        lateMinutes,
      },
    ];
  });
}

export function resolveCurrentMonthToDateRange(now: Date): CurrentMonthRange {
  const { year, month, day } = getVietnamDateParts(now);
  const paddedMonth = String(month).padStart(2, "0");
  const monthValue = `${year}-${paddedMonth}`;

  return {
    month: monthValue,
    from: `${monthValue}-01`,
    to: `${monthValue}-${String(day).padStart(2, "0")}`,
  };
}

export function minutesToHours(minutes: number) {
  return Math.round((minutes / 60) * 100) / 100;
}

function calculateShiftLateMinutes(checkInAt: string | null, plannedStart: string) {
  if (!checkInAt) {
    return 0;
  }

  return Math.max(0, timeToMinutes(checkInAt) - timeToMinutes(plannedStart));
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}
