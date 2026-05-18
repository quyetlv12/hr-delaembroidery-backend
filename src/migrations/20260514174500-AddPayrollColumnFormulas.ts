import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddPayrollColumnFormulas20260514174500 implements MigrationInterface {
  name = "AddPayrollColumnFormulas20260514174500";

  async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn("payroll_formula_settings", "column_formulas");
    if (hasColumn) {
      return;
    }

    await queryRunner.addColumn(
      "payroll_formula_settings",
      new TableColumn({
        name: "column_formulas",
        type: "json",
        isNullable: true,
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("payroll_formula_settings", "column_formulas");
  }
}
