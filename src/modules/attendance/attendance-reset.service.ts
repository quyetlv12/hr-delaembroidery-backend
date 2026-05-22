import type { EntityManager } from "typeorm";

import { getDaysInVietnamMonth } from "../../common/vietnam-time";
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
    const preservedBonuses = await preserveMonthlyBonuses(manager, dto.month, dto.year);

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
      preservedBonuses,
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

async function preserveMonthlyBonuses(manager: EntityManager, month: number, year: number) {
  if (
    !(await tableExists(manager, "employee_monthly_bonuses")) ||
    !(await tableExists(manager, "salary_records")) ||
    !(await tableExists(manager, "salary_periods"))
  ) {
    return 0;
  }

  const updateResult = await manager.query(
    `
      UPDATE employee_monthly_bonuses bonus
      INNER JOIN salary_records record
        ON record.employeeId = bonus.employeeId
      INNER JOIN salary_periods period
        ON period.id = record.salaryPeriodId
      SET
        bonus.amount = record.bonus,
        bonus.updated_at = CURRENT_TIMESTAMP,
        bonus.deleted_at = NULL
      WHERE period.month = ?
        AND period.year = ?
        AND bonus.month = ?
        AND bonus.year = ?
        AND CAST(record.bonus AS DECIMAL(15, 2)) <> 0
    `,
    [month, year, month, year],
  );

  const insertResult = await manager.query(
    `
      INSERT INTO employee_monthly_bonuses (
        id,
        employeeId,
        month,
        year,
        amount,
        created_at,
        updated_at,
        deleted_at
      )
      SELECT
        UUID(),
        record.employeeId,
        period.month,
        period.year,
        record.bonus,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        NULL
      FROM salary_records record
      INNER JOIN salary_periods period
        ON period.id = record.salaryPeriodId
      LEFT JOIN employee_monthly_bonuses bonus
        ON bonus.employeeId = record.employeeId
        AND bonus.month = period.month
        AND bonus.year = period.year
      WHERE period.month = ?
        AND period.year = ?
        AND bonus.id IS NULL
        AND CAST(record.bonus AS DECIMAL(15, 2)) <> 0
    `,
    [month, year],
  );

  return getAffectedRows(updateResult) + getAffectedRows(insertResult);
}

function getAffectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    return result.reduce((total, item) => total + getAffectedRows(item), 0);
  }

  if (result && typeof result === "object" && "affectedRows" in result) {
    const affectedRows = Number((result as { affectedRows?: unknown }).affectedRows);
    return Number.isFinite(affectedRows) ? affectedRows : 0;
  }

  return 0;
}

function getMonthRange(month: number, year: number) {
  const lastDay = getDaysInVietnamMonth(month, year);
  return {
    from: `${year}-${String(month).padStart(2, "0")}-01`,
    to: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}
