import "reflect-metadata";

import { AppDataSource } from "./data-source";

const tables = [
  "salary_email_logs",
  "salary_details",
  "salary_records",
  "salary_periods",
  "attendance_logs",
  "attendance_summary",
] as const;

async function resetAttendanceAndPayroll() {
  await AppDataSource.initialize();

  try {
    const preservedBonuses = await preserveMonthlyBonuses();
    await AppDataSource.query("SET FOREIGN_KEY_CHECKS=0");
    for (const table of tables) {
      if (!(await tableExists(table))) {
        console.log(`Bỏ qua bảng chưa tồn tại: ${table}`);
        continue;
      }

      await AppDataSource.query(`DELETE FROM \`${table}\``);
    }
    await AppDataSource.query("SET FOREIGN_KEY_CHECKS=1");
    console.log(`Đã xóa dữ liệu chấm công và bảng lương. Giữ lại ${preservedBonuses} dòng thưởng theo kỳ.`);
  } finally {
    await AppDataSource.destroy();
  }
}

void resetAttendanceAndPayroll().catch(async (error: unknown) => {
  try {
    await AppDataSource.query("SET FOREIGN_KEY_CHECKS=1");
  } catch {
    // Ignore cleanup errors so the original error is visible.
  }

  console.error(error);
  process.exitCode = 1;
});

async function tableExists(tableName: string) {
  const rows = (await AppDataSource.query("SHOW TABLES LIKE ?", [tableName])) as unknown[];
  return rows.length > 0;
}

async function preserveMonthlyBonuses() {
  if (
    !(await tableExists("employee_monthly_bonuses")) ||
    !(await tableExists("salary_records")) ||
    !(await tableExists("salary_periods"))
  ) {
    return 0;
  }

  const updateResult = await AppDataSource.query(`
    UPDATE employee_monthly_bonuses bonus
    INNER JOIN salary_records record
      ON record.employeeId = bonus.employeeId
    INNER JOIN salary_periods period
      ON period.id = record.salaryPeriodId
    SET
      bonus.amount = record.bonus,
      bonus.updated_at = CURRENT_TIMESTAMP,
      bonus.deleted_at = NULL
	    WHERE bonus.month = period.month
	      AND bonus.year = period.year
	      AND CAST(record.bonus AS DECIMAL(15, 2)) <> 0
	  `);

  const insertResult = await AppDataSource.query(`
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
    WHERE bonus.id IS NULL
      AND CAST(record.bonus AS DECIMAL(15, 2)) <> 0
  `);

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
