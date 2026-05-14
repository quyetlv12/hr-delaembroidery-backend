import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateEmployeeViewSettings20260512104000 implements MigrationInterface {
  name = "CreateEmployeeViewSettings20260512104000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "employee_view_settings",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "payroll_columns", type: "json", isNullable: true },
          { name: "attendance_columns", type: "json", isNullable: true },
          { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "updated_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "deleted_at", type: "datetime", isNullable: true },
        ],
      }),
      true,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("employee_view_settings", true);
  }
}
