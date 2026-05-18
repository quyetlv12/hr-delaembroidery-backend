import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

const salaryColumns = [
  "configured_salary",
  "insurance_salary",
  "fixed_daily_salary",
  "responsibility_allowance",
  "meal_allowance",
  "phone_allowance",
  "kpi_allowance",
  "daily_total",
  "overtime_work_day",
  "total_work_day",
  "gross_salary",
  "employer_insurance_total",
  "total_insurance",
  "advance_total",
] as const;

export class AddExcelPayrollColumns20260510113000 implements MigrationInterface {
  name = "AddExcelPayrollColumns20260510113000";

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const name of salaryColumns) {
      const hasColumn = await queryRunner.hasColumn("salary_records", name);
      if (hasColumn) {
        continue;
      }

      await queryRunner.addColumn(
        "salary_records",
        new TableColumn({
          name,
          type: "decimal",
          precision: name.endsWith("_work_day") ? 5 : 15,
          scale: 2,
          default: 0,
        }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const columnName of [...salaryColumns].reverse()) {
      const hasColumn = await queryRunner.hasColumn("salary_records", columnName);
      if (hasColumn) {
        await queryRunner.dropColumn("salary_records", columnName);
      }
    }
  }
}
