import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddEmployeeShiftCount20260509172000 implements MigrationInterface {
  name = "AddEmployeeShiftCount20260509172000";

  async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn("employees", "shift_count");
    if (hasColumn) {
      return;
    }

    await queryRunner.addColumn(
      "employees",
      new TableColumn({
        name: "shift_count",
        type: "int",
        default: 2,
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("employees", "shift_count");
  }
}
