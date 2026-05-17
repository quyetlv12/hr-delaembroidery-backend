import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";

export class CreateEmployeeSalaryHistories20260517174500 implements MigrationInterface {
  name = "CreateEmployeeSalaryHistories20260517174500";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "employee_salary_histories",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "employeeId", type: "varchar", length: "36" },
          { name: "previous_salary", type: "decimal", precision: 15, scale: 2 },
          { name: "new_salary", type: "decimal", precision: 15, scale: 2 },
          { name: "change_amount", type: "decimal", precision: 15, scale: 2 },
          { name: "change_percent", type: "decimal", precision: 8, scale: 4, isNullable: true },
          { name: "change_source", type: "varchar", length: "50" },
          { name: "change_mode", type: "varchar", length: "30", isNullable: true },
          { name: "change_value", type: "decimal", precision: 15, scale: 2, isNullable: true },
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
      "employee_salary_histories",
      new TableForeignKey({
        columnNames: ["employeeId"],
        referencedColumnNames: ["id"],
        referencedTableName: "employees",
        onDelete: "CASCADE",
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("employee_salary_histories", true);
  }
}
