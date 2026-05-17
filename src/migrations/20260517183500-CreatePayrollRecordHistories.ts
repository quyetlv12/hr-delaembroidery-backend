import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";

export class CreatePayrollRecordHistories20260517183500 implements MigrationInterface {
  name = "CreatePayrollRecordHistories20260517183500";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "payroll_record_histories",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "salaryPeriodId", type: "varchar", length: "36" },
          { name: "salaryRecordId", type: "varchar", length: "36" },
          { name: "employeeId", type: "varchar", length: "36" },
          { name: "action", type: "varchar", length: "30", default: "'update'" },
          { name: "requested_fields", type: "json" },
          { name: "changed_fields", type: "json" },
          { name: "previous_snapshot", type: "json" },
          { name: "next_snapshot", type: "json" },
          { name: "changed_by_user_id", type: "varchar", length: "36", isNullable: true },
          { name: "changed_by_login_code", type: "varchar", length: "50", isNullable: true },
          { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "updated_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "deleted_at", type: "datetime", isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      "payroll_record_histories",
      new TableForeignKey({
        columnNames: ["salaryPeriodId"],
        referencedColumnNames: ["id"],
        referencedTableName: "salary_periods",
        onDelete: "CASCADE",
      }),
    );

    await queryRunner.createForeignKey(
      "payroll_record_histories",
      new TableForeignKey({
        columnNames: ["salaryRecordId"],
        referencedColumnNames: ["id"],
        referencedTableName: "salary_records",
        onDelete: "CASCADE",
      }),
    );

    await queryRunner.createForeignKey(
      "payroll_record_histories",
      new TableForeignKey({
        columnNames: ["employeeId"],
        referencedColumnNames: ["id"],
        referencedTableName: "employees",
        onDelete: "CASCADE",
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("payroll_record_histories", true);
  }
}
