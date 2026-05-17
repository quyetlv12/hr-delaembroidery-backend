import type { EntityManager } from "typeorm";

import { AppDataSource } from "../../database/data-source";
import type { ResetAttendancePayrollDto } from "./attendance.dto";

export async function resetAttendancePayrollPeriod(dto: ResetAttendancePayrollDto) {
  const dateRange = getMonthRange(dto.month, dto.year);

  return AppDataSource.transaction(async (manager) => {
    const attendanceLogIds = await selectIds(manager, "SELECT id FROM attendance_logs WHERE work_date BETWEEN ? AND ?", [
      dateRange.from,
      dateRange.to,
    ]);
    const attendanceSummaryIds = await selectIds(
      manager,
      "SELECT id FROM attendance_summary WHERE work_date BETWEEN ? AND ?",
      [dateRange.from, dateRange.to],
    );
    const salaryPeriodIds = await selectIds(manager, "SELECT id FROM salary_periods WHERE month = ? AND year = ?", [
      dto.month,
      dto.year,
    ]);
    const salaryRecordIds =
      salaryPeriodIds.length > 0 && (await tableExists(manager, "salary_records"))
        ? await selectIds(
            manager,
            `SELECT id FROM salary_records WHERE salaryPeriodId IN (${createPlaceholders(salaryPeriodIds)})`,
            salaryPeriodIds,
          )
        : [];
    const salaryDetailIds =
      salaryRecordIds.length > 0 && (await tableExists(manager, "salary_details"))
        ? await selectIds(
            manager,
            `SELECT id FROM salary_details WHERE salaryRecordId IN (${createPlaceholders(salaryRecordIds)})`,
            salaryRecordIds,
          )
        : [];
    const salaryEmailLogIds = await selectSalaryEmailLogIds(manager, salaryPeriodIds, salaryRecordIds);

    await deleteByIds(manager, "salary_email_logs", salaryEmailLogIds);
    await deleteByIds(manager, "salary_details", salaryDetailIds);
    await deleteByIds(manager, "salary_records", salaryRecordIds);
    await deleteByIds(manager, "salary_periods", salaryPeriodIds);
    await manager.query("DELETE FROM attendance_logs WHERE work_date BETWEEN ? AND ?", [dateRange.from, dateRange.to]);
    await manager.query("DELETE FROM attendance_summary WHERE work_date BETWEEN ? AND ?", [
      dateRange.from,
      dateRange.to,
    ]);

    return {
      month: dto.month,
      year: dto.year,
      attendanceLogs: attendanceLogIds.length,
      attendanceRows: attendanceSummaryIds.length,
      payrollPeriods: salaryPeriodIds.length,
      payrollRecords: salaryRecordIds.length,
      salaryDetails: salaryDetailIds.length,
      salaryEmailLogs: salaryEmailLogIds.length,
    };
  });
}

async function selectIds(manager: EntityManager, sql: string, params: unknown[]) {
  const rows = (await manager.query(sql, params)) as Array<{ id: string }>;
  return rows.map((row) => row.id);
}

async function tableExists(manager: EntityManager, tableName: string) {
  const rows = (await manager.query("SHOW TABLES LIKE ?", [tableName])) as unknown[];
  return rows.length > 0;
}

function createPlaceholders(values: unknown[]) {
  return values.map(() => "?").join(", ");
}

async function deleteByIds(manager: EntityManager, tableName: string, ids: string[]) {
  if (ids.length === 0 || !(await tableExists(manager, tableName))) {
    return;
  }

  await manager.query(`DELETE FROM ${tableName} WHERE id IN (${createPlaceholders(ids)})`, ids);
}

async function selectSalaryEmailLogIds(
  manager: EntityManager,
  salaryPeriodIds: string[],
  salaryRecordIds: string[],
) {
  if (!(await tableExists(manager, "salary_email_logs"))) {
    return [];
  }

  const conditions: string[] = [];
  const params: string[] = [];
  if (salaryPeriodIds.length > 0) {
    conditions.push(`salaryPeriodId IN (${createPlaceholders(salaryPeriodIds)})`);
    params.push(...salaryPeriodIds);
  }
  if (salaryRecordIds.length > 0) {
    conditions.push(`salaryRecordId IN (${createPlaceholders(salaryRecordIds)})`);
    params.push(...salaryRecordIds);
  }
  if (conditions.length === 0) {
    return [];
  }

  return selectIds(manager, `SELECT id FROM salary_email_logs WHERE ${conditions.join(" OR ")}`, params);
}

function getMonthRange(month: number, year: number) {
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${String(month).padStart(2, "0")}-01`,
    to: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}
