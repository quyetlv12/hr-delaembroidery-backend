import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddNightShiftAttendance20260512100000 implements MigrationInterface {
  name = "AddNightShiftAttendance20260512100000";

  async up(queryRunner: QueryRunner): Promise<void> {
    const attendanceSummaryColumns = [
      new TableColumn({ name: "night_check_in_at", type: "datetime", isNullable: true }),
      new TableColumn({ name: "night_check_out_at", type: "datetime", isNullable: true }),
    ];
    for (const column of attendanceSummaryColumns) {
      const hasColumn = await queryRunner.hasColumn("attendance_summary", column.name);
      if (!hasColumn) {
        await queryRunner.addColumn("attendance_summary", column);
      }
    }

    const attendanceSettingColumns = [
      new TableColumn({ name: "night_start", type: "varchar", length: "5", default: "'18:00'" }),
      new TableColumn({ name: "night_end", type: "varchar", length: "5", default: "'21:00'" }),
    ];
    for (const column of attendanceSettingColumns) {
      const hasColumn = await queryRunner.hasColumn("attendance_settings", column.name);
      if (!hasColumn) {
        await queryRunner.addColumn("attendance_settings", column);
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("attendance_settings", "night_end");
    await queryRunner.dropColumn("attendance_settings", "night_start");
    await queryRunner.dropColumn("attendance_summary", "night_check_out_at");
    await queryRunner.dropColumn("attendance_summary", "night_check_in_at");
  }
}
