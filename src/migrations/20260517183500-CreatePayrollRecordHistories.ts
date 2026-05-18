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

    await this.createForeignKeyIfMissing(queryRunner, "salaryPeriodId", "salary_periods");
    await this.createForeignKeyIfMissing(queryRunner, "salaryRecordId", "salary_records");
    await this.createForeignKeyIfMissing(queryRunner, "employeeId", "employees");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("payroll_record_histories", true);
  }

  private async createForeignKeyIfMissing(
    queryRunner: QueryRunner,
    columnName: string,
    referencedTableName: string,
  ) {
    const table = await queryRunner.getTable("payroll_record_histories");
    const hasForeignKey = table?.foreignKeys.some(
      (foreignKey) =>
        foreignKey.columnNames.includes(columnName) &&
        foreignKey.referencedTableName === referencedTableName &&
        foreignKey.referencedColumnNames.includes("id"),
    );

    if (hasForeignKey) {
      return;
    }

    await queryRunner.createForeignKey(
      "payroll_record_histories",
      new TableForeignKey({
        columnNames: [columnName],
        referencedColumnNames: ["id"],
        referencedTableName,
        onDelete: "CASCADE",
      }),
    );
  }
}
