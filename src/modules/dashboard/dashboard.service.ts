import { MoreThan } from "typeorm";

import { AppDataSource } from "../../database/data-source";
import { AttendanceSummary, Employee, SalaryRecord } from "../../entities";

export type DashboardFilter = {
  employeeId?: string;
  from?: string;
  to?: string;
};

export class DashboardService {
  private readonly employeeRepository = AppDataSource.getRepository(Employee);
  private readonly attendanceRepository = AppDataSource.getRepository(AttendanceSummary);
  private readonly salaryRepository = AppDataSource.getRepository(SalaryRecord);

  async getSummary(filter: DashboardFilter = {}) {
    const range = resolveRange(filter);
    const today = new Date().toISOString().slice(0, 10);

    const [
      totalEmployees,
      activeEmployees,
      todayLateEmployees,
      monthlyPayroll,
      overtimeMinutes,
      payrollByMonth,
      attendanceByDay,
      employeesByDepartment,
      employeeGrowth,
    ] = await Promise.all([
      this.countEmployees(filter),
      this.countActiveEmployees(filter),
      this.countTodayLate(filter, today),
      this.sumPayroll(filter, range),
      this.sumOvertimeMinutes(filter, range),
      this.getPayrollByMonth(filter, range),
      this.getAttendanceByDay(filter, range),
      this.getEmployeesByDepartment(filter),
      this.getEmployeeGrowth(filter, range),
    ]);

    return {
      totalEmployees,
      activeEmployees,
      todayLateEmployees,
      monthlyPayroll,
      overtimeHours: Math.round((overtimeMinutes / 60) * 10) / 10,
      payrollByMonth,
      attendanceByDay,
      employeesByDepartment,
      employeeGrowth,
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
}

// ── Helpers ─────────────────────────────────────────────────────────────
function resolveRange(filter: DashboardFilter): { from: string; to: string } {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    from: filter.from ?? toDateString(defaultFrom),
    to: filter.to ?? toDateString(defaultTo),
  };
}

function toDateString(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
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
