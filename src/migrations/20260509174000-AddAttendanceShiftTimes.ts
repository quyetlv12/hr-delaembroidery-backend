import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddAttendanceShiftTimes20260509174000 implements MigrationInterface {
  name = "AddAttendanceShiftTimes20260509174000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns("attendance_summary", [
      new TableColumn({ name: "morning_check_in_at", type: "datetime", isNullable: true }),
      new TableColumn({ name: "morning_check_out_at", type: "datetime", isNullable: true }),
      new TableColumn({ name: "afternoon_check_in_at", type: "datetime", isNullable: true }),
      new TableColumn({ name: "afternoon_check_out_at", type: "datetime", isNullable: true }),
    ]);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns("attendance_summary", [
      "afternoon_check_out_at",
      "afternoon_check_in_at",
      "morning_check_out_at",
      "morning_check_in_at",
    ]);
  }
}
