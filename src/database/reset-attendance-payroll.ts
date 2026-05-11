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
    await AppDataSource.query("SET FOREIGN_KEY_CHECKS=0");
    for (const table of tables) {
      if (!(await tableExists(table))) {
        console.log(`Bỏ qua bảng chưa tồn tại: ${table}`);
        continue;
      }

      await AppDataSource.query(`DELETE FROM \`${table}\``);
    }
    await AppDataSource.query("SET FOREIGN_KEY_CHECKS=1");
    console.log("Đã xóa dữ liệu chấm công và bảng lương.");
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
