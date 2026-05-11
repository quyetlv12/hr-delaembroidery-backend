import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddEmployeeTimekeepingCode20260509170500 implements MigrationInterface {
  name = "AddEmployeeTimekeepingCode20260509170500";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "employees",
      new TableColumn({
        name: "timekeeping_code",
        type: "varchar",
        length: "50",
        isNullable: true,
        isUnique: true,
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("employees", "timekeeping_code");
  }
}
