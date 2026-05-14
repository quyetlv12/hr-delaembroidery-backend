import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddNightShiftAttendance20260512100000 implements MigrationInterface {
  name = "AddNightShiftAttendance20260512100000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns("attendance_summary", [
      new TableColumn({ name: "night_check_in_at", type: "datetime", isNullable: true }),
      new TableColumn({ name: "night_check_out_at", type: "datetime", isNullable: true }),
    ]);
    await queryRunner.addColumns("attendance_settings", [
      new TableColumn({ name: "night_start", type: "varchar", length: "5", default: "'18:00'" }),
      new TableColumn({ name: "night_end", type: "varchar", length: "5", default: "'21:00'" }),
    ]);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("attendance_settings", "night_end");
    await queryRunner.dropColumn("attendance_settings", "night_start");
    await queryRunner.dropColumn("attendance_summary", "night_check_out_at");
    await queryRunner.dropColumn("attendance_summary", "night_check_in_at");
  }
}
