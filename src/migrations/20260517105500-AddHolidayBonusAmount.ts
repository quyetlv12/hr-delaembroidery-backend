import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddHolidayBonusAmount20260517105500 implements MigrationInterface {
  name = "AddHolidayBonusAmount20260517105500";

  async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn("holidays", "bonus_amount");
    if (hasColumn) {
      return;
    }

    await queryRunner.addColumn(
      "holidays",
      new TableColumn({
        name: "bonus_amount",
        type: "decimal",
        precision: 15,
        scale: 2,
        default: 0,
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn("holidays", "bonus_amount");
    if (!hasColumn) {
      return;
    }

    await queryRunner.dropColumn("holidays", "bonus_amount");
  }
}
