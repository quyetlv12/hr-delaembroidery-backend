import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

export class CreateEmployeeMonthlyBonuses20260518113000 implements MigrationInterface {
  name = "CreateEmployeeMonthlyBonuses20260518113000";

  async up(queryRunner: QueryRunner): Promise<void> {
    const hasBonusTable = await queryRunner.hasTable("employee_monthly_bonuses");
    if (!hasBonusTable) {
      await queryRunner.createTable(
        new Table({
          name: "employee_monthly_bonuses",
          columns: [
            { name: "id", type: "varchar", length: "36", isPrimary: true },
            { name: "employeeId", type: "varchar", length: "36" },
            { name: "month", type: "int" },
            { name: "year", type: "int" },
            { name: "amount", type: "decimal", precision: 15, scale: 2, default: 0 },
            { name: "changed_by_user_id", type: "varchar", length: "36", isNullable: true },
            { name: "changed_by_login_code", type: "varchar", length: "50", isNullable: true },
            { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
            { name: "updated_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
            { name: "deleted_at", type: "datetime", isNullable: true },
          ],
        }),
        true,
      );
    }

    const bonusTable = await queryRunner.getTable("employee_monthly_bonuses");
    const hasBonusUniqueIndex = bonusTable?.indices.some((index) =>
      ["employeeId", "month", "year"].every((column) => index.columnNames.includes(column)),
    );
    if (!hasBonusUniqueIndex) {
      await queryRunner.createIndex(
        "employee_monthly_bonuses",
        new TableIndex({
          name: "IDX_employee_monthly_bonuses_employee_period",
          columnNames: ["employeeId", "month", "year"],
          isUnique: true,
        }),
      );
    }
    await ensureEmployeeForeignKey(queryRunner, "employee_monthly_bonuses", "FK_employee_monthly_bonuses_employee");

    const hasHistoryTable = await queryRunner.hasTable("employee_monthly_bonus_histories");
    if (!hasHistoryTable) {
      await queryRunner.createTable(
        new Table({
          name: "employee_monthly_bonus_histories",
          columns: [
            { name: "id", type: "varchar", length: "36", isPrimary: true },
            { name: "employeeId", type: "varchar", length: "36" },
            { name: "month", type: "int" },
            { name: "year", type: "int" },
            { name: "previous_bonus", type: "decimal", precision: 15, scale: 2, default: 0 },
            { name: "new_bonus", type: "decimal", precision: 15, scale: 2, default: 0 },
            { name: "changed_by_user_id", type: "varchar", length: "36", isNullable: true },
            { name: "changed_by_login_code", type: "varchar", length: "50", isNullable: true },
            { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
            { name: "updated_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
            { name: "deleted_at", type: "datetime", isNullable: true },
          ],
        }),
        true,
      );
    }

    const historyTable = await queryRunner.getTable("employee_monthly_bonus_histories");
    const hasHistoryIndex = historyTable?.indices.some((index) =>
      ["employeeId", "year", "month"].every((column) => index.columnNames.includes(column)),
    );
    if (!hasHistoryIndex) {
      await queryRunner.createIndex(
        "employee_monthly_bonus_histories",
        new TableIndex({
          name: "IDX_employee_monthly_bonus_histories_employee_period",
          columnNames: ["employeeId", "year", "month"],
        }),
      );
    }
    await ensureEmployeeForeignKey(
      queryRunner,
      "employee_monthly_bonus_histories",
      "FK_employee_monthly_bonus_histories_employee",
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("employee_monthly_bonus_histories", true);
    await queryRunner.dropTable("employee_monthly_bonuses", true);
  }
}

async function ensureEmployeeForeignKey(queryRunner: QueryRunner, tableName: string, foreignKeyName: string) {
  const hasEmployeeForeignKey = await hasForeignKey(queryRunner, tableName, "employeeId", "employees", "id");
  if (!hasEmployeeForeignKey) {
    await queryRunner.createForeignKey(
      tableName,
      new TableForeignKey({
        name: foreignKeyName,
        columnNames: ["employeeId"],
        referencedColumnNames: ["id"],
        referencedTableName: "employees",
        onDelete: "CASCADE",
      }),
    );
  }
}

async function hasForeignKey(
  queryRunner: QueryRunner,
  tableName: string,
  columnName: string,
  referencedTableName: string,
  referencedColumnName: string,
) {
  const rows = await queryRunner.query(
    `
      SELECT CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
        AND REFERENCED_TABLE_NAME = ?
        AND REFERENCED_COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName, referencedTableName, referencedColumnName],
  );
  return Array.isArray(rows) && rows.length > 0;
}
