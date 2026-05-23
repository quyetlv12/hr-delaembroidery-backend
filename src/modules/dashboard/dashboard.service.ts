import { MoreThan } from "typeorm";

import { APP_TIME_ZONE, formatVietnamTime, getVietnamDateParts, toVietnamDateString } from "../../common/vietnam-time";
import { AppDataSource } from "../../database/data-source";
import { AttendanceSetting, AttendanceSummary, Employee, SalaryRecord } from "../../entities";

export type DashboardFilter = {
  employeeId?: string;
  from?: string;
  to?: string;
};

export class DashboardService {
  private readonly employeeRepository = AppDataSource.getRepository(Employee);
  private readonly attendanceRepository = AppDataSource.getRepository(AttendanceSummary);
  private readonly attendanceSettingRepository = AppDataSource.getRepository(AttendanceSetting);
  private readonly salaryRepository = AppDataSource.getRepository(SalaryRecord);

  async getSummary(filter: DashboardFilter = {}) {
    const range = resolveRange(filter);
    const now = new Date();
    const today = toVietnamDateString(now);

    const [
      totalEmployees,
      activeEmployees,
      todayLateEmployees,
      todayLateEmployeeRows,
      monthlyPayroll,
      overtimeMinutes,
      payrollByMonth,
      attendanceByDay,
      employeesByDepartment,
      employeeGrowth,
      todayShiftAbsences,
    ] = await Promise.all([
      this.countEmployees(filter),
      this.countActiveEmployees(filter),
      this.countTodayLate(filter, today),
      this.getTodayLateEmployees(filter, today),
      this.sumPayroll(filter, range),
      this.sumOvertimeMinutes(filter, range),
      this.getPayrollByMonth(filter, range),
      this.getAttendanceByDay(filter, range),
      this.getEmployeesByDepartment(filter),
      this.getEmployeeGrowth(filter, range),
      this.getTodayShiftAbsences(filter, today, now),
    ]);

    return {
      totalEmployees,
      activeEmployees,
      todayLateEmployees,
      todayLateEmployeeRows,
      monthlyPayroll,
      overtimeHours: Math.round((overtimeMinutes / 60) * 10) / 10,
      payrollByMonth,
      attendanceByDay,
      employeesByDepartment,
      employeeGrowth,
      todayShiftAbsences,
    };
  }

  async getPublicSummary() {
    const now = new Date();
    const today = toVietnamDateString(now);
    const currentMonthRange = resolveCurrentMonthToDateRange(now);
    const [activeEmployees, lateEmployeeRows, monthlyAttendance, monthlyTotalsByEmployee] = await Promise.all([
      this.countActiveEmployees({}),
      this.getTodayLateEmployees({}, today),
      this.getPublicMonthlyAttendance(currentMonthRange),
      this.getMonthlyAttendanceTotalsByEmployee(currentMonthRange),
    ]);

    return {
      date: today,
      timezone: APP_TIME_ZONE,
      generatedAt: formatVietnamDateTime(now),
      workingEmployeeCount: activeEmployees,
      lateEmployeeCount: lateEmployeeRows.length,
      monthlyAttendance,
      lateEmployees: lateEmployeeRows.map((employee) =>
        toPublicLateEmployee(employee, monthlyTotalsByEmployee.get(employee.employeeId)),
      ),
    };
  }

  // ── Counters ──────────────────────────────────────────────────────────
  private countEmployees(filter: DashboardFilter) {
    if (filter.employeeId) {
      return this.employeeRepository.count({ where: { id: filter.employeeId } });
    }
    return this.employeeRepository.count();
  }

  private countActiveEmployees(filter: DashboardFilter) {
    if (filter.employeeId) {
      return this.employeeRepository.count({
        where: { id: filter.employeeId, status: "active" },
      });
    }
    return this.employeeRepository.count({ where: { status: "active" } });
  }

  private countTodayLate(filter: DashboardFilter, today: string) {
    return this.attendanceRepository.count({
      where: {
        workDate: today,
        lateMinutes: MoreThan(0),
        ...(filter.employeeId ? { employee: { id: filter.employeeId } } : {}),
      },
    });
  }

  private async getTodayLateEmployees(filter: DashboardFilter, today: string) {
    const settings = await this.getAttendanceSettings();
    const qb = this.attendanceRepository
      .createQueryBuilder("attendance")
      .leftJoinAndSelect("attendance.employee", "employee")
      .leftJoinAndSelect("employee.department", "department")
      .leftJoinAndSelect("employee.position", "position")
      .where("attendance.workDate = :today", { today })
      .andWhere("attendance.lateMinutes > 0")
      .orderBy("attendance.lateMinutes", "DESC")
      .addOrderBy("employee.employeeCode", "ASC");

    if (filter.employeeId) {
      qb.andWhere("employee.id = :employeeId", { employeeId: filter.employeeId });
    }

    const rows = await qb.getMany();
    return rows.map((summary) => ({
      employeeId: summary.employee.id,
      employeeCode: summary.employee.employeeCode,
      fullName: summary.employee.fullName,
      avatarUrl: summary.employee.avatarUrl ?? null,
      departmentName: summary.employee.department?.name ?? "Chưa phân bộ phận",
      positionName: summary.employee.position?.name ?? "Chưa có chức vụ",
      lateMinutes: Number(summary.lateMinutes ?? 0),
      firstCheckInAt: formatVietnamTime(
        summary.morningCheckInAt ?? summary.afternoonCheckInAt ?? summary.nightCheckInAt ?? summary.checkInAt,
      ),
      attendance: {
        date: summary.workDate,
        workDay: Number(summary.workDay ?? 0),
        lateMinutes: Number(summary.lateMinutes ?? 0),
        earlyLeaveMinutes: Number(summary.earlyLeaveMinutes ?? 0),
        overtimeMinutes: Number(summary.overtimeMinutes ?? 0),
        status: summary.status,
        shifts: [
          {
            key: "morning",
            label: "Ca sáng",
            plannedStart: settings.morningStart,
            plannedEnd: settings.morningEnd,
            checkInAt: formatVietnamTime(summary.morningCheckInAt),
            checkOutAt: formatVietnamTime(summary.morningCheckOutAt),
          },
          {
            key: "afternoon",
            label: "Ca chiều",
            plannedStart: settings.afternoonStart,
            plannedEnd: settings.afternoonEnd,
            checkInAt: formatVietnamTime(summary.afternoonCheckInAt),
            checkOutAt: formatVietnamTime(summary.afternoonCheckOutAt),
          },
          {
            key: "night",
            label: "Ca 3",
            plannedStart: settings.nightStart,
            plannedEnd: settings.nightEnd,
            checkInAt: formatVietnamTime(summary.nightCheckInAt),
            checkOutAt: formatVietnamTime(summary.nightCheckOutAt),
          },
        ],
      },
    }));
  }

  // ── Sums ──────────────────────────────────────────────────────────────
  private async sumPayroll(filter: DashboardFilter, range: { from: string; to: string }) {
    // Join salary_records → salary_periods, filter by period date range
    const qb = this.salaryRepository
      .createQueryBuilder("salary")
      .leftJoin("salary.salaryPeriod", "period")
      .select("COALESCE(SUM(salary.netSalary), 0)", "total")
      .where(
        "CONCAT(period.year, '-', LPAD(period.month, 2, '0'), '-01') BETWEEN :from AND :to",
        { from: range.from, to: range.to },
      );

    if (filter.employeeId) {
      qb.andWhere("salary.employee = :employeeId", { employeeId: filter.employeeId });
    }

    const result = await qb.getRawOne<{ total: string }>();
    return Number(result?.total ?? 0);
  }

  private async sumOvertimeMinutes(filter: DashboardFilter, range: { from: string; to: string }) {
    const qb = this.attendanceRepository
      .createQueryBuilder("att")
      .select("COALESCE(SUM(att.overtimeMinutes), 0)", "total")
      .where("att.workDate BETWEEN :from AND :to", { from: range.from, to: range.to });

    if (filter.employeeId) {
      qb.andWhere("att.employee = :employeeId", { employeeId: filter.employeeId });
    }

    const result = await qb.getRawOne<{ total: string }>();
    return Number(result?.total ?? 0);
  }

  private async getPublicMonthlyAttendance(range: CurrentMonthRange) {
    const result = await this.attendanceRepository
      .createQueryBuilder("attendance")
      .leftJoin("attendance.employee", "employee")
      .select("COALESCE(SUM(attendance.lateMinutes), 0)", "totalLateMinutes")
      .addSelect("COALESCE(SUM(attendance.earlyLeaveMinutes), 0)", "totalEarlyLeaveMinutes")
      .addSelect("COUNT(DISTINCT CASE WHEN attendance.lateMinutes > 0 THEN employee.id END)", "lateEmployeeCount")
      .addSelect(
        "COUNT(DISTINCT CASE WHEN attendance.earlyLeaveMinutes > 0 THEN employee.id END)",
        "earlyLeaveEmployeeCount",
      )
      .where("attendance.workDate BETWEEN :from AND :to", { from: range.from, to: range.to })
      .getRawOne<{
        totalLateMinutes: string;
        totalEarlyLeaveMinutes: string;
        lateEmployeeCount: string;
        earlyLeaveEmployeeCount: string;
      }>();

    const totalLateMinutes = Number(result?.totalLateMinutes ?? 0);
    const totalEarlyLeaveMinutes = Number(result?.totalEarlyLeaveMinutes ?? 0);
    const totalEarlyLateMinutes = totalLateMinutes + totalEarlyLeaveMinutes;

    return {
      month: range.month,
      from: range.from,
      to: range.to,
      lateEmployeeCount: Number(result?.lateEmployeeCount ?? 0),
      earlyLeaveEmployeeCount: Number(result?.earlyLeaveEmployeeCount ?? 0),
      totalLateMinutes,
      totalEarlyLeaveMinutes,
      totalEarlyLateMinutes,
      totalLateHours: minutesToHours(totalLateMinutes),
      totalEarlyLeaveHours: minutesToHours(totalEarlyLeaveMinutes),
      totalEarlyLateHours: minutesToHours(totalEarlyLateMinutes),
    };
  }

  private async getMonthlyAttendanceTotalsByEmployee(range: CurrentMonthRange) {
    const rows = await this.attendanceRepository
      .createQueryBuilder("attendance")
      .leftJoin("attendance.employee", "employee")
      .select("employee.id", "employeeId")
      .addSelect("COALESCE(SUM(attendance.lateMinutes), 0)", "lateMinutes")
      .addSelect("COALESCE(SUM(attendance.earlyLeaveMinutes), 0)", "earlyLeaveMinutes")
      .where("attendance.workDate BETWEEN :from AND :to", { from: range.from, to: range.to })
      .groupBy("employee.id")
      .getRawMany<{ employeeId: string; lateMinutes: string; earlyLeaveMinutes: string }>();

    return new Map(
      rows.map((row) => {
        const lateMinutes = Number(row.lateMinutes ?? 0);
        const earlyLeaveMinutes = Number(row.earlyLeaveMinutes ?? 0);
        return [
          row.employeeId,
          {
            lateMinutes,
            earlyLeaveMinutes,
          },
        ] as const;
      }),
    );
  }

  // ── Charts ────────────────────────────────────────────────────────────
  private async getPayrollByMonth(filter: DashboardFilter, range: { from: string; to: string }) {
    const qb = this.salaryRepository
      .createQueryBuilder("salary")
      .leftJoin("salary.salaryPeriod", "period")
      .select("CONCAT(period.year, '-', LPAD(period.month, 2, '0'))", "month")
      .addSelect("COALESCE(SUM(salary.netSalary), 0)", "amount")
      .where(
        "CONCAT(period.year, '-', LPAD(period.month, 2, '0'), '-01') BETWEEN :from AND :to",
        { from: range.from, to: range.to },
      )
      .groupBy("period.year")
      .addGroupBy("period.month")
      .orderBy("period.year", "ASC")
      .addOrderBy("period.month", "ASC");

    if (filter.employeeId) {
      qb.andWhere("salary.employee = :employeeId", { employeeId: filter.employeeId });
    }

    const rows = await qb.getRawMany<{ month: string; amount: string }>();
    return rows.map((row) => ({
      month: formatMonthLabel(row.month),
      amount: Number(row.amount),
    }));
  }

  private async getAttendanceByDay(filter: DashboardFilter, range: { from: string; to: string }) {
    const qb = this.attendanceRepository
      .createQueryBuilder("att")
      .select("att.workDate", "day")
      .addSelect("SUM(CASE WHEN att.workDay > 0 THEN 1 ELSE 0 END)", "present")
      .addSelect("SUM(CASE WHEN att.lateMinutes > 0 THEN 1 ELSE 0 END)", "late")
      .where("att.workDate BETWEEN :from AND :to", { from: range.from, to: range.to })
      .groupBy("att.workDate")
      .orderBy("att.workDate", "ASC");

    if (filter.employeeId) {
      qb.andWhere("att.employee = :employeeId", { employeeId: filter.employeeId });
    }

    const rows = await qb.getRawMany<{ day: string; present: string; late: string }>();
    return rows.map((row) => ({
      day: formatDayLabel(String(row.day)),
      present: Number(row.present),
      late: Number(row.late),
    }));
  }

  private async getEmployeesByDepartment(filter: DashboardFilter) {
    if (filter.employeeId) {
      const employee = await this.employeeRepository.findOne({
        where: { id: filter.employeeId },
        relations: { department: true },
      });
      const departmentName = employee?.department?.name ?? "Chưa phân bộ phận";
      return [{ department: departmentName, total: 1 }];
    }

    const rows = await this.employeeRepository
      .createQueryBuilder("emp")
      .leftJoin("emp.department", "dept")
      .select("COALESCE(dept.name, 'Chưa phân bộ phận')", "department")
      .addSelect("COUNT(emp.id)", "total")
      .groupBy("dept.id")
      .addGroupBy("dept.name")
      .getRawMany<{ department: string; total: string }>();

    return rows.map((row) => ({
      department: row.department,
      total: Number(row.total),
    }));
  }

  private async getEmployeeGrowth(filter: DashboardFilter, range: { from: string; to: string }) {
    const qb = this.employeeRepository
      .createQueryBuilder("emp")
      .select("DATE_FORMAT(emp.joinDate, '%Y-%m')", "month")
      .addSelect("COUNT(emp.id)", "count")
      .where("emp.joinDate BETWEEN :from AND :to", { from: range.from, to: range.to })
      .groupBy("DATE_FORMAT(emp.joinDate, '%Y-%m')")
      .orderBy("month", "ASC");

    if (filter.employeeId) {
      qb.andWhere("emp.id = :employeeId", { employeeId: filter.employeeId });
    }

    const rows = await qb.getRawMany<{ month: string; count: string }>();
    let runningTotal = 0;
    return rows.map((row) => {
      runningTotal += Number(row.count);
      return {
        month: formatMonthLabel(row.month),
        total: runningTotal,
      };
    });
  }

  private async getTodayShiftAbsences(filter: DashboardFilter, today: string, now: Date) {
    const settings = await this.getAttendanceSettings();
    const currentShift = resolveCurrentShift(settings, now);

    if (!currentShift) {
      return {
        date: today,
        shiftKey: "none",
        shiftLabel: "Ngoài giờ ca",
        startTime: null,
        endTime: null,
        total: 0,
        rows: [],
      };
    }

    const employeesQuery = this.employeeRepository
      .createQueryBuilder("employee")
      .leftJoinAndSelect("employee.department", "department")
      .leftJoinAndSelect("employee.position", "position")
      .where("employee.status IN (:...statuses)", { statuses: ["active", "probation"] })
      .andWhere("employee.shiftCount >= :shiftCount", { shiftCount: currentShift.minShiftCount })
      .orderBy("employee.employeeCode", "ASC");

    if (filter.employeeId) {
      employeesQuery.andWhere("employee.id = :employeeId", { employeeId: filter.employeeId });
    }

    const employees = await employeesQuery.getMany();
    const employeeIds = employees.map((employee) => employee.id);
    if (employeeIds.length === 0) {
      return {
        date: today,
        shiftKey: currentShift.key,
        shiftLabel: currentShift.label,
        startTime: currentShift.startTime,
        endTime: currentShift.endTime,
        total: 0,
        rows: [],
      };
    }

    const summaries = await this.attendanceRepository
      .createQueryBuilder("attendance")
      .leftJoinAndSelect("attendance.employee", "employee")
      .where("attendance.workDate = :today", { today })
      .andWhere("employee.id IN (:...employeeIds)", { employeeIds })
      .getMany();
    const checkedEmployeeIds = new Set(
      summaries
        .filter((summary) => hasCurrentShiftPunch(summary, currentShift, settings))
        .map((summary) => summary.employee.id),
    );
    const rows = employees
      .filter((employee) => !checkedEmployeeIds.has(employee.id))
      .map((employee) => ({
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        avatarUrl: employee.avatarUrl ?? null,
        departmentName: employee.department?.name ?? "Chưa phân bộ phận",
        positionName: employee.position?.name ?? "Chưa có chức vụ",
        shiftCount: employee.shiftCount,
      }));

    return {
      date: today,
      shiftKey: currentShift.key,
      shiftLabel: currentShift.label,
      startTime: currentShift.startTime,
      endTime: currentShift.endTime,
      total: rows.length,
      rows,
    };
  }

  private async getAttendanceSettings() {
    const settings = await this.attendanceSettingRepository.findOne({
      where: {},
      order: { createdAt: "ASC" },
    });

    return {
      morningStart: settings?.morningStart ?? "07:30",
      morningEnd: settings?.morningEnd ?? "11:30",
      afternoonStart: settings?.afternoonStart ?? "13:30",
      afternoonEnd: settings?.afternoonEnd ?? "17:30",
      nightStart: settings?.nightStart ?? "18:00",
      nightEnd: settings?.nightEnd ?? "21:00",
    };
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────
function resolveRange(filter: DashboardFilter): { from: string; to: string } {
  const now = getVietnamDateParts(new Date());
  const defaultFrom = new Date(Date.UTC(now.year, now.month - 6, 1));
  const defaultTo = new Date(Date.UTC(now.year, now.month, 0));

  return {
    from: filter.from ?? toVietnamDateString(defaultFrom),
    to: filter.to ?? toVietnamDateString(defaultTo),
  };
}

function formatMonthLabel(value: string) {
  // "YYYY-MM" → "MM/YYYY"
  const [year, month] = value.split("-");
  return `${month}/${year}`;
}

function formatDayLabel(value: string) {
  // "YYYY-MM-DD" or Date object string → "DD/MM"
  const dateStr = value.slice(0, 10);
  const [, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

function formatVietnamDateTime(value: Date) {
  const { year, month, day, hour, minute, second } = getVietnamDateParts(value);
  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
  return `${date}T${time}+07:00`;
}

type AttendanceSettingsForShift = {
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
  nightStart: string;
  nightEnd: string;
};

type CurrentMonthRange = { month: string; from: string; to: string };
type MonthlyAttendanceTotals = { lateMinutes: number; earlyLeaveMinutes: number };

type PublicLateEmployeeSource = {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  avatarUrl: string | null;
  departmentName: string;
  positionName: string;
  lateMinutes: number;
  firstCheckInAt: string | null;
};

type CurrentShift = {
  key: "morning" | "afternoon" | "night";
  label: string;
  startTime: string;
  endTime: string;
  minShiftCount: number;
  checkInProperty: "morningCheckInAt" | "afternoonCheckInAt" | "nightCheckInAt";
};

const SHIFT_CHECK_IN_TOLERANCE_MINUTES = 45;

function toPublicLateEmployee(employee: PublicLateEmployeeSource, monthlyTotals?: MonthlyAttendanceTotals) {
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
    monthlyLateMinutes,
    monthlyEarlyLeaveMinutes,
    monthlyEarlyLateMinutes,
    monthlyLateHours: minutesToHours(monthlyLateMinutes),
    monthlyEarlyLeaveHours: minutesToHours(monthlyEarlyLeaveMinutes),
    monthlyEarlyLateHours: minutesToHours(monthlyEarlyLateMinutes),
  };
}

function resolveCurrentMonthToDateRange(now: Date): CurrentMonthRange {
  const { year, month, day } = getVietnamDateParts(now);
  const paddedMonth = String(month).padStart(2, "0");
  const monthValue = `${year}-${paddedMonth}`;

  return {
    month: monthValue,
    from: `${monthValue}-01`,
    to: `${monthValue}-${String(day).padStart(2, "0")}`,
  };
}

function minutesToHours(minutes: number) {
  return Math.round((minutes / 60) * 100) / 100;
}

function hasCurrentShiftPunch(
  summary: AttendanceSummary,
  currentShift: CurrentShift,
  settings: AttendanceSettingsForShift,
) {
  if (summary[currentShift.checkInProperty]) {
    return true;
  }

  const startMinutes = timeToMinutes(currentShift.startTime);
  const endMinutes = getShiftFallbackEndMinutes(currentShift, settings);
  return getSummaryPunchMinutes(summary).some((minutes) =>
    isWithinTimeRange(minutes, startMinutes - SHIFT_CHECK_IN_TOLERANCE_MINUTES, endMinutes),
  );
}

function getSummaryPunchMinutes(summary: AttendanceSummary) {
  return [
    summary.checkInAt,
    summary.checkOutAt,
    summary.morningCheckInAt,
    summary.morningCheckOutAt,
    summary.afternoonCheckInAt,
    summary.afternoonCheckOutAt,
    summary.nightCheckInAt,
    summary.nightCheckOutAt,
  ]
    .map((value) => {
      const formattedTime = formatVietnamTime(value);
      return formattedTime ? timeToMinutes(formattedTime) : null;
    })
    .filter((value): value is number => value !== null);
}

function getShiftFallbackEndMinutes(currentShift: CurrentShift, settings: AttendanceSettingsForShift) {
  if (currentShift.key === "morning") {
    return timeToMinutes(settings.afternoonStart);
  }
  if (currentShift.key === "afternoon") {
    return timeToMinutes(settings.nightStart);
  }
  return timeToMinutes(currentShift.endTime);
}

function resolveCurrentShift(settings: AttendanceSettingsForShift, now: Date): CurrentShift | null {
  const vietnamTime = getVietnamDateParts(now);
  const currentMinutes = vietnamTime.hour * 60 + vietnamTime.minute;
  const morningStart = timeToMinutes(settings.morningStart);
  const morningEnd = timeToMinutes(settings.morningEnd);
  const afternoonStart = timeToMinutes(settings.afternoonStart);
  const afternoonEnd = timeToMinutes(settings.afternoonEnd);
  const nightStart = timeToMinutes(settings.nightStart);
  const nightEnd = timeToMinutes(settings.nightEnd);

  if (currentMinutes >= morningStart && currentMinutes < afternoonStart) {
    return {
      key: "morning",
      label: "Ca sáng",
      startTime: settings.morningStart,
      endTime: settings.morningEnd,
      minShiftCount: 1,
      checkInProperty: "morningCheckInAt",
    };
  }

  if (currentMinutes >= afternoonStart && currentMinutes < nightStart) {
    return {
      key: "afternoon",
      label: "Ca chiều",
      startTime: settings.afternoonStart,
      endTime: settings.afternoonEnd,
      minShiftCount: 2,
      checkInProperty: "afternoonCheckInAt",
    };
  }

  if (isWithinTimeRange(currentMinutes, nightStart, nightEnd)) {
    return {
      key: "night",
      label: "Ca 3",
      startTime: settings.nightStart,
      endTime: settings.nightEnd,
      minShiftCount: 3,
      checkInProperty: "nightCheckInAt",
    };
  }

  if (currentMinutes >= morningEnd && currentMinutes < afternoonStart) {
    return {
      key: "morning",
      label: "Ca sáng",
      startTime: settings.morningStart,
      endTime: settings.morningEnd,
      minShiftCount: 1,
      checkInProperty: "morningCheckInAt",
    };
  }

  if (currentMinutes >= afternoonEnd && currentMinutes < nightStart) {
    return {
      key: "afternoon",
      label: "Ca chiều",
      startTime: settings.afternoonStart,
      endTime: settings.afternoonEnd,
      minShiftCount: 2,
      checkInProperty: "afternoonCheckInAt",
    };
  }

  return null;
}

function isWithinTimeRange(currentMinutes: number, startMinutes: number, endMinutes: number) {
  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}
