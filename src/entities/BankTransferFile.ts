import { Column, Entity, OneToMany } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";
import { BankTransferDetail } from "./BankTransferDetail";

@Entity("bank_transfer_files")
export class BankTransferFile extends AppBaseEntity {
  @Column({ name: "bank_name", type: "varchar", length: 120 })
  bankName!: string;

  @Column({ name: "file_type", type: "varchar", length: 20 })
  fileType!: string;

  @Column({ name: "file_url", type: "varchar", nullable: true })
  fileUrl?: string | null;

  @Column({ name: "status", type: "varchar", length: 30, default: "generated" })
  status!: string;

  @OneToMany(() => BankTransferDetail, (detail) => detail.transferFile)
  details!: BankTransferDetail[];
}
