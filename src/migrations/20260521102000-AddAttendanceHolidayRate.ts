import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddAttendanceHolidayRate20260521102000 implements MigrationInterface {
  name = "AddAttendanceHolidayRate20260521102000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasHolidayRate = await queryRunner.hasColumn("attendance_settings", "holiday_rate");
    if (!hasHolidayRate) {
      await queryRunner.addColumn(
        "attendance_settings",
        new TableColumn({
          name: "holiday_rate",
          type: "decimal",
          precision: 5,
          scale: 2,
          default: "2",
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasHolidayRate = await queryRunner.hasColumn("attendance_settings", "holiday_rate");
    if (hasHolidayRate) {
      await queryRunner.dropColumn("attendance_settings", "holiday_rate");
    }
  }
}
