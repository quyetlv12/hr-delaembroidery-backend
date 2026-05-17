import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateHolidays20260514102500 implements MigrationInterface {
  name = "CreateHolidays20260514102500";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "holidays",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "name", type: "varchar", length: "150" },
          { name: "holiday_date", type: "date", isUnique: true },
          { name: "is_paid", type: "boolean", default: true },
          { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "updated_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "deleted_at", type: "datetime", isNullable: true },
        ],
      }),
      true,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("holidays", true);
  }
}
