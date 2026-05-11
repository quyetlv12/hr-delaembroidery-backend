import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameSystemRolesToVietnamese20260509173000 implements MigrationInterface {
  name = "RenameSystemRolesToVietnamese20260509173000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("UPDATE `roles` SET `name` = 'Quản trị viên' WHERE `name` = 'Admin'");
    await queryRunner.query("UPDATE `roles` SET `name` = 'Nhân viên' WHERE `name` = 'Nhan vien'");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("UPDATE `roles` SET `name` = 'Admin' WHERE `name` = 'Quản trị viên'");
    await queryRunner.query("UPDATE `roles` SET `name` = 'Nhan vien' WHERE `name` = 'Nhân viên'");
  }
}
