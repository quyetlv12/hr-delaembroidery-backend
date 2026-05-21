import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddAttendanceWeeklyDaysOff20260521100000 implements MigrationInterface {
  name = "AddAttendanceWeeklyDaysOff20260521100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasWeeklyDaysOff = await queryRunner.hasColumn("attendance_settings", "weekly_days_off");
    if (!hasWeeklyDaysOff) {
      await queryRunner.addColumn(
        "attendance_settings",
        new TableColumn({
          name: "weekly_days_off",
          type: "varchar",
          length: "30",
          default: "'0'",
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasWeeklyDaysOff = await queryRunner.hasColumn("attendance_settings", "weekly_days_off");
    if (hasWeeklyDaysOff) {
      await queryRunner.dropColumn("attendance_settings", "weekly_days_off");
    }
  }
}
