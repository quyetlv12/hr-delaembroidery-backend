import { MoreThan } from "typeorm";

import { AppDataSource } from "../../database/data-source";
import { AttendanceSummary, Employee, SalaryRecord } from "../../entities";

export class DashboardService {
  private readonly employeeRepository = AppDataSource.getRepository(Employee);
  private readonly attendanceRepository = AppDataSource.getRepository(AttendanceSummary);
  private readonly salaryRepository = AppDataSource.getRepository(SalaryRecord);

  async getSummary() {
    const today = new Date().toISOString().slice(0, 10);
    const [totalEmployees, activeEmployees, todayLateEmployees, monthlyPayroll] =
      await Promise.all([
        this.employeeRepository.count(),
        this.employeeRepository.count({ where: { status: "active" } }),
        this.attendanceRepository.count({
          where: { workDate: today, lateMinutes: MoreThan(0) },
        }),
        this.getMonthlyPayrollTotal(),
      ]);

    return {
      totalEmployees,
      activeEmployees,
      todayLateEmployees,
      monthlyPayroll,
      overtimeHours: 0,
      payrollByMonth: [],
      attendanceByDay: [],
      employeesByDepartment: [],
      employeeGrowth: [],
    };
  }

  private async getMonthlyPayrollTotal() {
    const result = await this.salaryRepository
      .createQueryBuilder("salary")
      .select("COALESCE(SUM(salary.net_salary), 0)", "total")
      .getRawOne<{ total: string }>();

    return Number(result?.total ?? 0);
  }
}
