import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddPayrollFormulaAllowanceDefaults20260517164500 implements MigrationInterface {
  name = "AddPayrollFormulaAllowanceDefaults20260517164500";

  async up(queryRunner: QueryRunner): Promise<void> {
    const columns = [
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
    ];

    for (const column of columns) {
      const hasColumn = await queryRunner.hasColumn("payroll_formula_settings", column.name);
      if (!hasColumn) {
        await queryRunner.addColumn("payroll_formula_settings", column);
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const columnName of ["default_phone_allowance", "default_meal_allowance"]) {
      const hasColumn = await queryRunner.hasColumn("payroll_formula_settings", columnName);
      if (hasColumn) {
        await queryRunner.dropColumn("payroll_formula_settings", columnName);
      }
    }
  }
}
