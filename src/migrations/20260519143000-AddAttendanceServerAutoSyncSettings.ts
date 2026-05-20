import { MigrationInterface, QueryRunner, TableColumn, type TableColumnOptions } from "typeorm";

export class AddAttendanceServerAutoSyncSettings20260519143000 implements MigrationInterface {
  name = "AddAttendanceServerAutoSyncSettings20260519143000";

  async up(queryRunner: QueryRunner): Promise<void> {
    const tableName = "attendance_server_settings";
    const hasTable = await queryRunner.hasTable(tableName);
    if (!hasTable) {
      return;
    }

    await ensureColumn(queryRunner, tableName, "auto_sync_enabled", {
      name: "auto_sync_enabled",
      type: "tinyint",
      width: 1,
      default: 0,
    });
    await ensureColumn(queryRunner, tableName, "auto_sync_month_data_id", {
      name: "auto_sync_month_data_id",
      type: "varchar",
      length: "60",
      default: "''",
    });
    await ensureColumn(queryRunner, tableName, "auto_sync_month_mappings", {
      name: "auto_sync_month_mappings",
      type: "json",
      isNullable: true,
    });
    await ensureColumn(queryRunner, tableName, "auto_sync_start_offset_minutes", {
      name: "auto_sync_start_offset_minutes",
      type: "int",
      default: 60,
    });
    await ensureColumn(queryRunner, tableName, "auto_sync_window_minutes", {
      name: "auto_sync_window_minutes",
      type: "int",
      default: 60,
    });
    await ensureColumn(queryRunner, tableName, "auto_sync_interval_minutes", {
      name: "auto_sync_interval_minutes",
      type: "int",
      default: 10,
    });
    await ensureColumn(queryRunner, tableName, "auto_sync_last_run_at", {
      name: "auto_sync_last_run_at",
      type: "datetime",
      isNullable: true,
    });
    await ensureColumn(queryRunner, tableName, "auto_sync_last_status", {
      name: "auto_sync_last_status",
      type: "varchar",
      length: "30",
      isNullable: true,
    });
    await ensureColumn(queryRunner, tableName, "auto_sync_last_message", {
      name: "auto_sync_last_message",
      type: "varchar",
      length: "255",
      isNullable: true,
    });
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const tableName = "attendance_server_settings";
    const hasTable = await queryRunner.hasTable(tableName);
    if (!hasTable) {
      return;
    }

    await dropColumnIfExists(queryRunner, tableName, "auto_sync_last_message");
    await dropColumnIfExists(queryRunner, tableName, "auto_sync_last_status");
    await dropColumnIfExists(queryRunner, tableName, "auto_sync_last_run_at");
    await dropColumnIfExists(queryRunner, tableName, "auto_sync_interval_minutes");
    await dropColumnIfExists(queryRunner, tableName, "auto_sync_window_minutes");
    await dropColumnIfExists(queryRunner, tableName, "auto_sync_start_offset_minutes");
    await dropColumnIfExists(queryRunner, tableName, "auto_sync_month_mappings");
    await dropColumnIfExists(queryRunner, tableName, "auto_sync_month_data_id");
    await dropColumnIfExists(queryRunner, tableName, "auto_sync_enabled");
  }
}

async function ensureColumn(
  queryRunner: QueryRunner,
  tableName: string,
  columnName: string,
  column: TableColumnOptions,
) {
  const hasColumn = await queryRunner.hasColumn(tableName, columnName);
  if (!hasColumn) {
    await queryRunner.addColumn(tableName, new TableColumn(column));
  }
}

async function dropColumnIfExists(queryRunner: QueryRunner, tableName: string, columnName: string) {
  const hasColumn = await queryRunner.hasColumn(tableName, columnName);
  if (hasColumn) {
    await queryRunner.dropColumn(tableName, columnName);
  }
}
