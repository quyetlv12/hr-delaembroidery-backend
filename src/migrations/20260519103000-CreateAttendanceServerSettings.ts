import { MigrationInterface, QueryRunner, Table, TableColumn, type TableColumnOptions } from "typeorm";

export class CreateAttendanceServerSettings20260519103000 implements MigrationInterface {
  name = "CreateAttendanceServerSettings20260519103000";

  async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable("attendance_server_settings");
    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: "attendance_server_settings",
          columns: [
            { name: "id", type: "varchar", length: "36", isPrimary: true },
            {
              name: "attendance_endpoint",
              type: "varchar",
              length: "255",
              default: "'https://global.yunatt.com/cardRecord/queryForMonth'",
            },
            {
              name: "staff_endpoint",
              type: "varchar",
              length: "255",
              default: "'https://global.yunatt.com/staff/query'",
            },
            { name: "session_cookie", type: "text" },
            { name: "updated_by_user_id", type: "varchar", length: "36", isNullable: true },
            { name: "updated_by_login_code", type: "varchar", length: "50", isNullable: true },
            { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
            { name: "updated_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
            { name: "deleted_at", type: "datetime", isNullable: true },
          ],
        }),
        true,
      );
      return;
    }

    await ensureColumn(queryRunner, "attendance_server_settings", "attendance_endpoint", {
      name: "attendance_endpoint",
      type: "varchar",
      length: "255",
      default: "'https://global.yunatt.com/cardRecord/queryForMonth'",
    });
    await ensureColumn(queryRunner, "attendance_server_settings", "staff_endpoint", {
      name: "staff_endpoint",
      type: "varchar",
      length: "255",
      default: "'https://global.yunatt.com/staff/query'",
    });
    await ensureColumn(queryRunner, "attendance_server_settings", "session_cookie", {
      name: "session_cookie",
      type: "text",
    });
    await ensureColumn(queryRunner, "attendance_server_settings", "updated_by_user_id", {
      name: "updated_by_user_id",
      type: "varchar",
      length: "36",
      isNullable: true,
    });
    await ensureColumn(queryRunner, "attendance_server_settings", "updated_by_login_code", {
      name: "updated_by_login_code",
      type: "varchar",
      length: "50",
      isNullable: true,
    });
    await ensureColumn(queryRunner, "attendance_server_settings", "created_at", {
      name: "created_at",
      type: "datetime",
      default: "CURRENT_TIMESTAMP",
    });
    await ensureColumn(queryRunner, "attendance_server_settings", "updated_at", {
      name: "updated_at",
      type: "datetime",
      default: "CURRENT_TIMESTAMP",
    });
    await ensureColumn(queryRunner, "attendance_server_settings", "deleted_at", {
      name: "deleted_at",
      type: "datetime",
      isNullable: true,
    });
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("attendance_server_settings", true);
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
