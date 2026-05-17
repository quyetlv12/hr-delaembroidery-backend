import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddPayrollFormulaAllowanceDefaults20260517164500 implements MigrationInterface {
  name = "AddPayrollFormulaAllowanceDefaults20260517164500";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns("payroll_formula_settings", [
      new TableColumn({
        name: "default_meal_allowance",
        type: "decimal",
        precision: 15,
        scale: 2,
        default: 30000,
      }),
      new TableColumn({
        name: "default_phone_allowance",
        type: "decimal",
        precision: 15,
        scale: 2,
        default: 20000,
      }),
    ]);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("payroll_formula_settings", "default_phone_allowance");
    await queryRunner.dropColumn("payroll_formula_settings", "default_meal_allowance");
  }
}
