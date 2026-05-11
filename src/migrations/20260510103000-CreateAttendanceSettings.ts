import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateAttendanceSettings20260510103000 implements MigrationInterface {
  name = "CreateAttendanceSettings20260510103000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "attendance_settings",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "morning_start", type: "varchar", length: "5", default: "'07:30'" },
          { name: "morning_end", type: "varchar", length: "5", default: "'11:30'" },
          { name: "afternoon_start", type: "varchar", length: "5", default: "'13:30'" },
          { name: "afternoon_end", type: "varchar", length: "5", default: "'17:30'" },
          { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "updated_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "deleted_at", type: "datetime", isNullable: true },
        ],
      }),
      true,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("attendance_settings", true);
  }
}
