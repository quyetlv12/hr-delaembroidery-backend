import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddAttendanceServerShiftWindows20260521105000 implements MigrationInterface {
  name = "AddAttendanceServerShiftWindows20260521105000";

  async up(queryRunner: QueryRunner): Promise<void> {
    const tableName = "attendance_server_settings";
    const hasTable = await queryRunner.hasTable(tableName);
    if (!hasTable) {
      return;
    }

    const hasColumn = await queryRunner.hasColumn(tableName, "auto_sync_shift_windows");
    if (!hasColumn) {
      await queryRunner.addColumn(
        tableName,
        new TableColumn({
          name: "auto_sync_shift_windows",
          type: "json",
          isNullable: true,
        }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const tableName = "attendance_server_settings";
    const hasTable = await queryRunner.hasTable(tableName);
    if (!hasTable) {
      return;
    }

    const hasColumn = await queryRunner.hasColumn(tableName, "auto_sync_shift_windows");
    if (hasColumn) {
      await queryRunner.dropColumn(tableName, "auto_sync_shift_windows");
    }
  }
}
