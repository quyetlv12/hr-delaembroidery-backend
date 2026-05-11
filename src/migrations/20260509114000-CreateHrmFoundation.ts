import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateHrmFoundation20260509114000 implements MigrationInterface {
  name = "CreateHrmFoundation20260509114000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "roles",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "name", type: "varchar", length: "100", isUnique: true },
          { name: "is_system", type: "boolean", default: false },
          { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "updated_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "deleted_at", type: "datetime", isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "permissions",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "code", type: "varchar", length: "100", isUnique: true },
          { name: "module", type: "varchar", length: "80" },
          { name: "action", type: "varchar", length: "80" },
          { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "updated_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "deleted_at", type: "datetime", isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "users",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "email", type: "varchar", length: "180", isUnique: true },
          { name: "password_hash", type: "varchar", length: "255" },
          { name: "full_name", type: "varchar", length: "180" },
          { name: "is_active", type: "boolean", default: true },
          { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "updated_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "deleted_at", type: "datetime", isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "role_permissions",
        columns: [
          { name: "role_id", type: "varchar", length: "36", isPrimary: true },
          { name: "permission_id", type: "varchar", length: "36", isPrimary: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "user_roles",
        columns: [
          { name: "user_id", type: "varchar", length: "36", isPrimary: true },
          { name: "role_id", type: "varchar", length: "36", isPrimary: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "departments",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "code", type: "varchar", length: "50", isUnique: true },
          { name: "name", type: "varchar", length: "150" },
          { name: "description", type: "text", isNullable: true },
          { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "updated_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "deleted_at", type: "datetime", isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "positions",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "code", type: "varchar", length: "50", isUnique: true },
          { name: "name", type: "varchar", length: "150" },
          { name: "departmentId", type: "varchar", length: "36", isNullable: true },
          { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "updated_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "deleted_at", type: "datetime", isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "employees",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "employee_code", type: "varchar", length: "50", isUnique: true },
          { name: "timekeeping_code", type: "varchar", length: "50", isUnique: true, isNullable: true },
          { name: "full_name", type: "varchar", length: "180" },
          { name: "avatar_url", type: "varchar", isNullable: true },
          { name: "avatar_public_id", type: "varchar", isNullable: true },
          { name: "avatar_uploaded_at", type: "datetime", isNullable: true },
          { name: "gender", type: "varchar", length: "20" },
          { name: "birthday", type: "date", isNullable: true },
          { name: "email", type: "varchar", length: "180", isUnique: true },
          { name: "phone", type: "varchar", length: "40", isNullable: true },
          { name: "cccd", type: "varchar", length: "30", isNullable: true },
          { name: "address", type: "text", isNullable: true },
          { name: "join_date", type: "date" },
          { name: "contract_type", type: "varchar", length: "80", isNullable: true },
          { name: "shift_count", type: "int", default: 2 },
          { name: "base_salary", type: "decimal", precision: 15, scale: 2, default: 0 },
          { name: "tax_code", type: "varchar", length: "50", isNullable: true },
          { name: "insurance_code", type: "varchar", length: "50", isNullable: true },
          { name: "status", type: "varchar", length: "30", default: "'active'" },
          { name: "departmentId", type: "varchar", length: "36", isNullable: true },
          { name: "positionId", type: "varchar", length: "36", isNullable: true },
          { name: "user_id", type: "varchar", length: "36", isNullable: true },
          { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "updated_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          { name: "deleted_at", type: "datetime", isNullable: true },
        ],
      }),
      true,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("employees", true);
    await queryRunner.dropTable("positions", true);
    await queryRunner.dropTable("departments", true);
    await queryRunner.dropTable("user_roles", true);
    await queryRunner.dropTable("role_permissions", true);
    await queryRunner.dropTable("users", true);
    await queryRunner.dropTable("permissions", true);
    await queryRunner.dropTable("roles", true);
  }
}
