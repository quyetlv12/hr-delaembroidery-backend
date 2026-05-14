import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreatePayrollFormulaSettings20260512103000 implements MigrationInterface {
  name = "CreatePayrollFormulaSettings20260512103000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "payroll_formula_settings",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "insurance_base_salary", type: "decimal", precision: 15, scale: 2, default: 5062000 },
          { name: "employee_insurance_rate", type: "decimal", precision: 7, scale: 4, default: 10.5 },
          { name: "employer_insurance_rate", type: "decimal", precision: 7, scale: 4, default: 21.5 },
          { name: "earning_categories", type: "json", isNullable: true },
          { name: "deduction_categories", type: "json", isNullable: true },
          { name: "daily_salary_formula", type: "text" },
          { name: "gross_salary_formula", type: "text" },
          { name: "deduction_formula", type: "text" },
          { name: "net_salary_formula", type: "text" },
          { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "updated_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "deleted_at", type: "datetime", isNullable: true },
        ],
      }),
      true,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("payroll_formula_settings", true);
  }
}
