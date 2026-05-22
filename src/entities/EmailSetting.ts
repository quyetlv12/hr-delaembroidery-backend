import { Column, Entity } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";

@Entity("email_settings")
export class EmailSetting extends AppBaseEntity {
  @Column({ name: "smtp_host", type: "varchar", length: 255, nullable: true })
  smtpHost?: string | null;

  @Column({ name: "smtp_port", type: "int", default: 587 })
  smtpPort!: number;

  @Column({ name: "smtp_user", type: "varchar", length: 180, nullable: true })
  smtpUser?: string | null;

  @Column({ name: "smtp_pass", type: "text", nullable: true })
  smtpPass?: string | null;

  @Column({ name: "mail_from", type: "varchar", length: 255, nullable: true })
  mailFrom?: string | null;

  @Column({ name: "updated_by_user_id", type: "varchar", length: 36, nullable: true })
  updatedByUserId?: string | null;

  @Column({ name: "updated_by_login_code", type: "varchar", length: 50, nullable: true })
  updatedByLoginCode?: string | null;
}
