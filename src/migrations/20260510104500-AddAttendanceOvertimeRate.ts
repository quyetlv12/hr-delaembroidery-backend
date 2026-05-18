import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddAttendanceOvertimeRate20260510104500 implements MigrationInterface {
  name = "AddAttendanceOvertimeRate20260510104500";

  async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn("attendance_settings", "overtime_rate");
    if (hasColumn) {
      return;
    }

    await queryRunner.addColumn(
      "attendance_settings",
      new TableColumn({
        name: "overtime_rate",
        type: "decimal",
        precision: 5,
        scale: 2,
        default: "1.5",
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("attendance_settings", "overtime_rate");
  }
}
