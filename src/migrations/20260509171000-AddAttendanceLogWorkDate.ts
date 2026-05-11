import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddAttendanceLogWorkDate20260509171000 implements MigrationInterface {
  name = "AddAttendanceLogWorkDate20260509171000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "attendance_logs",
      new TableColumn({
        name: "work_date",
        type: "date",
        isNullable: true,
      }),
    );
    await queryRunner.query(`
      UPDATE attendance_logs
      SET work_date = COALESCE(
        DATE(check_in_at),
        DATE(JSON_UNQUOTE(JSON_EXTRACT(raw_payload, '$.date'))),
        DATE(created_at)
      )
      WHERE work_date IS NULL
    `);
    await queryRunner.changeColumn(
      "attendance_logs",
      "work_date",
      new TableColumn({
        name: "work_date",
        type: "date",
        isNullable: false,
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("attendance_logs", "work_date");
  }
}
