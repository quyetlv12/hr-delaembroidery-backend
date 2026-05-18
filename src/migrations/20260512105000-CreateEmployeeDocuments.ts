import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";

export class CreateEmployeeDocuments20260512105000 implements MigrationInterface {
  name = "CreateEmployeeDocuments20260512105000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "employee_documents",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "employeeId", type: "varchar", length: "36" },
          { name: "original_name", type: "varchar", length: "255" },
          { name: "stored_name", type: "varchar", length: "255" },
          { name: "mime_type", type: "varchar", length: "120", isNullable: true },
          { name: "size", type: "bigint", default: 0 },
          { name: "storage_path", type: "varchar", length: "500" },
          { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "updated_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "deleted_at", type: "datetime", isNullable: true },
        ],
      }),
      true,
    );
    const table = await queryRunner.getTable("employee_documents");
    const hasEmployeeForeignKey = table?.foreignKeys.some(
      (foreignKey) =>
        foreignKey.columnNames.includes("employeeId") &&
        foreignKey.referencedTableName === "employees" &&
        foreignKey.referencedColumnNames.includes("id"),
    );

    if (!hasEmployeeForeignKey) {
      await queryRunner.createForeignKey(
        "employee_documents",
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
    await queryRunner.dropTable("employee_documents", true);
  }
}
