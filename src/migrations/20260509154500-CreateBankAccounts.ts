import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";

export class CreateBankAccounts20260509154500 implements MigrationInterface {
  name = "CreateBankAccounts20260509154500";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "bank_accounts",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "bank_name", type: "varchar", length: "120" },
          { name: "account_number", type: "varchar", length: "80" },
          { name: "account_holder", type: "varchar", length: "180" },
          { name: "is_primary", type: "boolean", default: true },
          { name: "employeeId", type: "varchar", length: "36" },
          { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "updated_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "deleted_at", type: "datetime", isNullable: true },
        ],
      }),
      true,
    );

    const table = await queryRunner.getTable("bank_accounts");
    const hasEmployeeForeignKey = table?.foreignKeys.some(
      (foreignKey) =>
        foreignKey.columnNames.includes("employeeId") &&
        foreignKey.referencedTableName === "employees" &&
        foreignKey.referencedColumnNames.includes("id"),
    );

    if (!hasEmployeeForeignKey) {
      await queryRunner.createForeignKey(
        "bank_accounts",
        new TableForeignKey({
          columnNames: ["employeeId"],
          referencedColumnNames: ["id"],
          referencedTableName: "employees",
          onDelete: "CASCADE",
        }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("bank_accounts", true);
  }
}
