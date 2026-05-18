import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSalaryRecordBonus20260518100000 implements MigrationInterface {
  name = "AddSalaryRecordBonus20260518100000";

  async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("salary_records");
    const hasColumn = table?.columns.some((col) => col.name === "bonus");
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE salary_records ADD COLUMN bonus DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER bonus_total`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("salary_records");
    const hasColumn = table?.columns.some((col) => col.name === "bonus");
    if (hasColumn) {
      await queryRunner.query(`ALTER TABLE salary_records DROP COLUMN bonus`);
    }
  }
}
