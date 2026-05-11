import { Column, Entity, ManyToOne } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";
import { BankAccount } from "./BankAccount";
import { BankTransferFile } from "./BankTransferFile";
import { SalaryRecord } from "./SalaryRecord";

@Entity("bank_transfer_details")
export class BankTransferDetail extends AppBaseEntity {
  @ManyToOne(() => BankTransferFile, (transferFile) => transferFile.details)
  transferFile!: BankTransferFile;

  @ManyToOne(() => SalaryRecord)
  salaryRecord!: SalaryRecord;

  @ManyToOne(() => BankAccount, (bankAccount) => bankAccount.transferDetails)
  bankAccount!: BankAccount;

  @Column({ name: "amount", type: "decimal", precision: 15, scale: 2, default: 0 })
  amount!: string;

  @Column({ name: "transfer_content", type: "varchar", length: 255 })
  transferContent!: string;
}
