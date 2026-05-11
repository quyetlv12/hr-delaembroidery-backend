import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from "typeorm";

export class AddUserLoginCode20260510110000 implements MigrationInterface {
  name = "AddUserLoginCode20260510110000";

  async up(queryRunner: QueryRunner): Promise<void> {
    const hasLoginCodeColumn = await queryRunner.hasColumn("users", "login_code");
    if (!hasLoginCodeColumn) {
      await queryRunner.addColumn(
        "users",
        new TableColumn({
          name: "login_code",
          type: "varchar",
          length: "6",
          isNullable: true,
        }),
      );
    }

    const users = (await queryRunner.query(`
      SELECT u.id, u.login_code, e.employee_code
      FROM users u
      LEFT JOIN employees e ON e.user_id = u.id
      ORDER BY u.created_at ASC, u.id ASC
    `)) as Array<{ id: string; login_code: string | null; employee_code: string | null }>;
    const usedCodes = new Set(
      users.map((user) => user.login_code).filter((loginCode): loginCode is string => Boolean(loginCode)),
    );
    let nextCodeNumber = 1;

    const usersWithoutCode = users.filter((user) => !user.login_code);
    const orderedUsers = [
      ...usersWithoutCode.filter((user) => !user.employee_code),
      ...usersWithoutCode.filter((user) => user.employee_code && /^\d{1,3}$/.test(user.employee_code)),
      ...usersWithoutCode.filter((user) => user.employee_code && !/^\d{1,3}$/.test(user.employee_code)),
    ];

    for (const user of orderedUsers) {
      const preferredLoginCode = getPreferredLoginCode(user.employee_code);
      const loginCode =
        preferredLoginCode && !usedCodes.has(preferredLoginCode)
          ? preferredLoginCode
          : getNextLoginCode(usedCodes, () => {
              const nextLoginCode = `DLE${String(nextCodeNumber).padStart(3, "0")}`;
              nextCodeNumber += 1;
              return nextLoginCode;
            });

      await queryRunner.query("UPDATE users SET login_code = ? WHERE id = ?", [loginCode, user.id]);
      usedCodes.add(loginCode);
    }

    const table = await queryRunner.getTable("users");
    const loginCodeColumn = table?.findColumnByName("login_code");
    if (loginCodeColumn?.isNullable) {
      await queryRunner.changeColumn(
        "users",
        "login_code",
        new TableColumn({
          name: "login_code",
          type: "varchar",
          length: "6",
          isNullable: false,
        }),
      );
    }

    const updatedTable = await queryRunner.getTable("users");
    const hasLoginCodeIndex = updatedTable?.indices.some((index) => index.name === "IDX_users_login_code_unique");
    if (!hasLoginCodeIndex) {
      await queryRunner.createIndex(
        "users",
        new TableIndex({
          name: "IDX_users_login_code_unique",
          columnNames: ["login_code"],
          isUnique: true,
        }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("users");
    const hasLoginCodeIndex = table?.indices.some((index) => index.name === "IDX_users_login_code_unique");
    if (hasLoginCodeIndex) {
      await queryRunner.dropIndex("users", "IDX_users_login_code_unique");
    }

    const hasLoginCodeColumn = await queryRunner.hasColumn("users", "login_code");
    if (hasLoginCodeColumn) {
      await queryRunner.dropColumn("users", "login_code");
    }
  }
}

function getPreferredLoginCode(employeeCode: string | null) {
  if (!employeeCode || !/^\d{1,3}$/.test(employeeCode)) {
    return null;
  }

  const numericCode = Number(employeeCode);
  if (numericCode < 1 || numericCode > 999) {
    return null;
  }

  return `DLE${String(numericCode).padStart(3, "0")}`;
}

function getNextLoginCode(usedCodes: Set<string>, nextCode: () => string) {
  let loginCode = nextCode();
  while (usedCodes.has(loginCode)) {
    loginCode = nextCode();
  }
  return loginCode;
}
