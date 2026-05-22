import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from "typeorm";

export class CreateSalaryEmailLogs20260521132000 implements MigrationInterface {
  name = "CreateSalaryEmailLogs20260521132000";

  async up(queryRunner: QueryRunner): Promise<void> {
    const hasEmailLogTable = await queryRunner.hasTable("salary_email_logs");
    if (!hasEmailLogTable) {
      await queryRunner.createTable(
        new Table({
          name: "salary_email_logs",
          columns: [
            { name: "id", type: "varchar", length: "36", isPrimary: true },
            { name: "employeeId", type: "varchar", length: "36" },
            { name: "salaryPeriodId", type: "varchar", length: "36" },
            { name: "salaryRecordId", type: "varchar", length: "36" },
            { name: "sentById", type: "varchar", length: "36", isNullable: true },
            { name: "email", type: "varchar", length: "180" },
            { name: "status", type: "varchar", length: "30" },
            { name: "sent_at", type: "datetime", isNullable: true },
            { name: "error_message", type: "text", isNullable: true },
            { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
            { name: "updated_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
            { name: "deleted_at", type: "datetime", isNullable: true },
          ],
        }),
        true,
      );
    } else {
      await ensureColumn(queryRunner, "salary_email_logs", new TableColumn({ name: "employeeId", type: "varchar", length: "36" }));
      await ensureColumn(queryRunner, "salary_email_logs", new TableColumn({ name: "salaryPeriodId", type: "varchar", length: "36" }));
      await ensureColumn(queryRunner, "salary_email_logs", new TableColumn({ name: "salaryRecordId", type: "varchar", length: "36" }));
      await ensureColumn(
        queryRunner,
        "salary_email_logs",
        new TableColumn({ name: "sentById", type: "varchar", length: "36", isNullable: true }),
      );
      await ensureColumn(queryRunner, "salary_email_logs", new TableColumn({ name: "email", type: "varchar", length: "180" }));
      await ensureColumn(queryRunner, "salary_email_logs", new TableColumn({ name: "status", type: "varchar", length: "30" }));
      await ensureColumn(
        queryRunner,
        "salary_email_logs",
        new TableColumn({ name: "sent_at", type: "datetime", isNullable: true }),
      );
      await ensureColumn(
        queryRunner,
        "salary_email_logs",
        new TableColumn({ name: "error_message", type: "text", isNullable: true }),
      );
    }

    await ensureIndex(queryRunner, "salary_email_logs", "IDX_salary_email_logs_period", ["salaryPeriodId"]);
    await ensureIndex(queryRunner, "salary_email_logs", "IDX_salary_email_logs_employee", ["employeeId"]);
    await ensureIndex(queryRunner, "salary_email_logs", "IDX_salary_email_logs_status", ["status"]);

    await ensureForeignKey(queryRunner, {
      tableName: "salary_email_logs",
      columnName: "employeeId",
      referencedTableName: "employees",
      referencedColumnName: "id",
      foreignKeyName: "FK_salary_email_logs_employee",
      onDelete: "CASCADE",
    });
    await ensureForeignKey(queryRunner, {
      tableName: "salary_email_logs",
      columnName: "salaryPeriodId",
      referencedTableName: "salary_periods",
      referencedColumnName: "id",
      foreignKeyName: "FK_salary_email_logs_period",
      onDelete: "CASCADE",
    });
    await ensureForeignKey(queryRunner, {
      tableName: "salary_email_logs",
      columnName: "salaryRecordId",
      referencedTableName: "salary_records",
      referencedColumnName: "id",
      foreignKeyName: "FK_salary_email_logs_record",
      onDelete: "CASCADE",
    });
    await ensureForeignKey(queryRunner, {
      tableName: "salary_email_logs",
      columnName: "sentById",
      referencedTableName: "users",
      referencedColumnName: "id",
      foreignKeyName: "FK_salary_email_logs_sent_by",
      onDelete: "SET NULL",
      isNullable: true,
    });
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("salary_email_logs", true);
  }
}

async function ensureColumn(queryRunner: QueryRunner, tableName: string, column: TableColumn) {
  const hasColumn = await queryRunner.hasColumn(tableName, column.name);
  if (!hasColumn) {
    await queryRunner.addColumn(tableName, column);
  }
}

async function ensureIndex(queryRunner: QueryRunner, tableName: string, indexName: string, columnNames: string[]) {
  const table = await queryRunner.getTable(tableName);
  const hasIndex = table?.indices.some((index) => index.name === indexName);
  if (!hasIndex) {
    await queryRunner.createIndex(
      tableName,
      new TableIndex({
        name: indexName,
        columnNames,
      }),
    );
  }
}

async function ensureForeignKey(
  queryRunner: QueryRunner,
  input: {
    tableName: string;
    columnName: string;
    referencedTableName: string;
    referencedColumnName: string;
    foreignKeyName: string;
    onDelete: "CASCADE" | "SET NULL";
    isNullable?: boolean;
  },
) {
  const hasExistingForeignKey = await hasForeignKey(
    queryRunner,
    input.tableName,
    input.columnName,
    input.referencedTableName,
    input.referencedColumnName,
  );
  if (hasExistingForeignKey) {
    return;
  }

  await alignColumnWithReferencedColumn(
    queryRunner,
    input.tableName,
    input.columnName,
    input.referencedTableName,
    input.referencedColumnName,
    Boolean(input.isNullable),
  );
  await queryRunner.createForeignKey(
    input.tableName,
    new TableForeignKey({
      name: input.foreignKeyName,
      columnNames: [input.columnName],
      referencedColumnNames: [input.referencedColumnName],
      referencedTableName: input.referencedTableName,
      onDelete: input.onDelete,
    }),
  );
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

async function alignColumnWithReferencedColumn(
  queryRunner: QueryRunner,
  tableName: string,
  columnName: string,
  referencedTableName: string,
  referencedColumnName: string,
  isNullable: boolean,
) {
  const [referencedColumn] = (await queryRunner.query(
    `
      SELECT COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [referencedTableName, referencedColumnName],
  )) as Array<{
    COLUMN_TYPE: string;
    CHARACTER_SET_NAME: string | null;
    COLLATION_NAME: string | null;
  }>;

  if (!referencedColumn?.COLUMN_TYPE) {
    return;
  }

  const characterSet = toSafeMysqlName(referencedColumn.CHARACTER_SET_NAME);
  const collation = toSafeMysqlName(referencedColumn.COLLATION_NAME);
  const characterSetClause = characterSet ? ` CHARACTER SET ${characterSet}` : "";
  const collationClause = collation ? ` COLLATE ${collation}` : "";
  const nullClause = isNullable ? " NULL" : " NOT NULL";

  await queryRunner.query(
    `ALTER TABLE ${quoteIdentifier(tableName)} MODIFY COLUMN ${quoteIdentifier(columnName)} ${referencedColumn.COLUMN_TYPE}${characterSetClause}${collationClause}${nullClause}`,
  );
}

function quoteIdentifier(value: string) {
  return `\`${value.replace(/`/g, "``")}\``;
}

function toSafeMysqlName(value?: string | null) {
  if (!value || !/^[0-9A-Za-z_]+$/.test(value)) {
    return "";
  }
  return value;
}
