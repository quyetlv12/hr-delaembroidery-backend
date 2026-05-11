import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";

const baseColumns = [
  { name: "id", type: "varchar", length: "36", isPrimary: true },
  { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
  { name: "updated_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
  { name: "deleted_at", type: "datetime", isNullable: true },
];

export class CreateAttendancePayrollTables20260509165000 implements MigrationInterface {
  name = "CreateAttendancePayrollTables20260509165000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "attendance_logs",
        columns: [
          ...baseColumns,
          { name: "source", type: "varchar", length: "40" },
          { name: "work_date", type: "date" },
          { name: "check_in_at", type: "datetime", isNullable: true },
          { name: "check_out_at", type: "datetime", isNullable: true },
          { name: "raw_payload", type: "json", isNullable: true },
          { name: "employeeId", type: "varchar", length: "36" },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "attendance_summary",
        columns: [
          ...baseColumns,
          { name: "work_date", type: "date" },
          { name: "check_in_at", type: "datetime", isNullable: true },
          { name: "check_out_at", type: "datetime", isNullable: true },
          { name: "morning_check_in_at", type: "datetime", isNullable: true },
          { name: "morning_check_out_at", type: "datetime", isNullable: true },
          { name: "afternoon_check_in_at", type: "datetime", isNullable: true },
          { name: "afternoon_check_out_at", type: "datetime", isNullable: true },
          { name: "late_minutes", type: "int", default: 0 },
          { name: "early_leave_minutes", type: "int", default: 0 },
          { name: "overtime_minutes", type: "int", default: 0 },
          { name: "work_day", type: "decimal", precision: 4, scale: 2, default: 0 },
          { name: "status", type: "varchar", length: "40", default: "'present'" },
          { name: "employeeId", type: "varchar", length: "36" },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "salary_periods",
        columns: [
          ...baseColumns,
          { name: "month", type: "int" },
          { name: "year", type: "int" },
          { name: "status", type: "varchar", length: "30", default: "'draft'" },
          { name: "locked_at", type: "datetime", isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "salary_records",
        columns: [
          ...baseColumns,
          { name: "base_salary", type: "decimal", precision: 15, scale: 2, default: 0 },
          { name: "work_day", type: "decimal", precision: 5, scale: 2, default: 0 },
          { name: "standard_work_day", type: "decimal", precision: 5, scale: 2, default: 0 },
          { name: "allowance_total", type: "decimal", precision: 15, scale: 2, default: 0 },
          { name: "bonus_total", type: "decimal", precision: 15, scale: 2, default: 0 },
          { name: "overtime_total", type: "decimal", precision: 15, scale: 2, default: 0 },
          { name: "insurance_total", type: "decimal", precision: 15, scale: 2, default: 0 },
          { name: "tax_total", type: "decimal", precision: 15, scale: 2, default: 0 },
          { name: "deduction_total", type: "decimal", precision: 15, scale: 2, default: 0 },
          { name: "net_salary", type: "decimal", precision: 15, scale: 2, default: 0 },
          { name: "status", type: "varchar", length: "30", default: "'draft'" },
          { name: "employeeId", type: "varchar", length: "36" },
          { name: "salaryPeriodId", type: "varchar", length: "36" },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "salary_details",
        columns: [
          ...baseColumns,
          { name: "type", type: "varchar", length: "40" },
          { name: "label", type: "varchar", length: "150" },
          { name: "amount", type: "decimal", precision: 15, scale: 2, default: 0 },
          { name: "salaryRecordId", type: "varchar", length: "36" },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "allowances",
        columns: [
          ...baseColumns,
          { name: "name", type: "varchar", length: "150" },
          { name: "amount", type: "decimal", precision: 15, scale: 2, default: 0 },
          { name: "is_active", type: "boolean", default: true },
          { name: "employeeId", type: "varchar", length: "36" },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "deductions",
        columns: [
          ...baseColumns,
          { name: "name", type: "varchar", length: "150" },
          { name: "amount", type: "decimal", precision: 15, scale: 2, default: 0 },
          { name: "is_active", type: "boolean", default: true },
          { name: "employeeId", type: "varchar", length: "36" },
        ],
      }),
      true,
    );

    await this.createEmployeeForeignKey(queryRunner, "attendance_logs");
    await this.createEmployeeForeignKey(queryRunner, "attendance_summary");
    await this.createEmployeeForeignKey(queryRunner, "salary_records");
    await this.createEmployeeForeignKey(queryRunner, "allowances");
    await this.createEmployeeForeignKey(queryRunner, "deductions");
    await queryRunner.createForeignKey(
      "salary_records",
      new TableForeignKey({
        columnNames: ["salaryPeriodId"],
        referencedColumnNames: ["id"],
        referencedTableName: "salary_periods",
        onDelete: "CASCADE",
      }),
    );
    await queryRunner.createForeignKey(
      "salary_details",
      new TableForeignKey({
        columnNames: ["salaryRecordId"],
        referencedColumnNames: ["id"],
        referencedTableName: "salary_records",
        onDelete: "CASCADE",
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("deductions", true);
    await queryRunner.dropTable("allowances", true);
    await queryRunner.dropTable("salary_details", true);
    await queryRunner.dropTable("salary_records", true);
    await queryRunner.dropTable("salary_periods", true);
    await queryRunner.dropTable("attendance_summary", true);
    await queryRunner.dropTable("attendance_logs", true);
  }

  private createEmployeeForeignKey(queryRunner: QueryRunner, tableName: string) {
    return queryRunner.createForeignKey(
      tableName,
      new TableForeignKey({
        columnNames: ["employeeId"],
        referencedColumnNames: ["id"],
        referencedTableName: "employees",
        onDelete: "CASCADE",
      }),
    );
  }
}
