import { MigrationInterface, QueryRunner, Table, TableColumn, type TableColumnOptions } from "typeorm";

export class CreateEmailSettings20260521143000 implements MigrationInterface {
  name = "CreateEmailSettings20260521143000";

  async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable("email_settings");
    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: "email_settings",
          columns: [
            { name: "id", type: "varchar", length: "36", isPrimary: true },
            { name: "smtp_host", type: "varchar", length: "255", isNullable: true },
            { name: "smtp_port", type: "int", default: 587 },
            { name: "smtp_user", type: "varchar", length: "180", isNullable: true },
            { name: "smtp_pass", type: "text", isNullable: true },
            { name: "mail_from", type: "varchar", length: "255", isNullable: true },
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

    await ensureColumn(queryRunner, "email_settings", "smtp_host", {
      name: "smtp_host",
      type: "varchar",
      length: "255",
      isNullable: true,
    });
    await ensureColumn(queryRunner, "email_settings", "smtp_port", {
      name: "smtp_port",
      type: "int",
      default: 587,
    });
    await ensureColumn(queryRunner, "email_settings", "smtp_user", {
      name: "smtp_user",
      type: "varchar",
      length: "180",
      isNullable: true,
    });
    await ensureColumn(queryRunner, "email_settings", "smtp_pass", {
      name: "smtp_pass",
      type: "text",
      isNullable: true,
    });
    await ensureColumn(queryRunner, "email_settings", "mail_from", {
      name: "mail_from",
      type: "varchar",
      length: "255",
      isNullable: true,
    });
    await ensureColumn(queryRunner, "email_settings", "updated_by_user_id", {
      name: "updated_by_user_id",
      type: "varchar",
      length: "36",
      isNullable: true,
    });
    await ensureColumn(queryRunner, "email_settings", "updated_by_login_code", {
      name: "updated_by_login_code",
      type: "varchar",
      length: "50",
      isNullable: true,
    });
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("email_settings", true);
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
