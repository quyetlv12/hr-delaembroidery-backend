import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreatePayrollFormulaHistoryTemplates20260517153000 implements MigrationInterface {
  name = "CreatePayrollFormulaHistoryTemplates20260517153000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "payroll_formula_histories",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "action", type: "varchar", length: "30", default: "'update'" },
          { name: "change_note", type: "varchar", length: "255", isNullable: true },
          { name: "changed_by_user_id", type: "varchar", length: "36", isNullable: true },
          { name: "changed_by_login_code", type: "varchar", length: "50", isNullable: true },
          { name: "snapshot", type: "json" },
          { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "updated_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "deleted_at", type: "datetime", isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "payroll_formula_templates",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "name", type: "varchar", length: "120" },
          { name: "description", type: "varchar", length: "255", isNullable: true },
          { name: "created_by_user_id", type: "varchar", length: "36", isNullable: true },
          { name: "created_by_login_code", type: "varchar", length: "50", isNullable: true },
          { name: "snapshot", type: "json" },
          { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "updated_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "deleted_at", type: "datetime", isNullable: true },
        ],
      }),
      true,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("payroll_formula_templates", true);
    await queryRunner.dropTable("payroll_formula_histories", true);
  }
}
