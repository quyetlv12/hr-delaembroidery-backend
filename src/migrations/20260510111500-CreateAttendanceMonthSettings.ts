import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreateAttendanceMonthSettings20260510111500 implements MigrationInterface {
  name = "CreateAttendanceMonthSettings20260510111500";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "attendance_month_settings",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "month", type: "int" },
          { name: "year", type: "int" },
          { name: "standard_work_day", type: "decimal", precision: 5, scale: 2, default: 0 },
          { name: "holiday_paid_days", type: "decimal", precision: 5, scale: 2, default: 0 },
          { name: "holiday_bonus_amount", type: "decimal", precision: 15, scale: 2, default: 0 },
          { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "updated_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "deleted_at", type: "datetime", isNullable: true },
        ],
      }),
      true,
    );

    const table = await queryRunner.getTable("attendance_month_settings");
    const hasPeriodIndex = table?.indices.some((index) => index.name === "IDX_attendance_month_settings_period_unique");
    if (!hasPeriodIndex) {
      await queryRunner.createIndex(
        "attendance_month_settings",
        new TableIndex({
          name: "IDX_attendance_month_settings_period_unique",
          columnNames: ["year", "month"],
          isUnique: true,
        }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("attendance_month_settings", true);
  }
}
