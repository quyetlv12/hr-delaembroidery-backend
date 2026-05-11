import { Column, Entity, ManyToOne, OneToMany } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";
import { BankTransferDetail } from "./BankTransferDetail";
import { Employee } from "./Employee";

@Entity("bank_accounts")
export class BankAccount extends AppBaseEntity {
  @ManyToOne(() => Employee, (employee) => employee.bankAccounts)
  employee!: Employee;

  @Column({ name: "bank_name", type: "varchar", length: 120 })
  bankName!: string;

  @Column({ name: "account_number", type: "varchar", length: 80 })
  accountNumber!: string;

  @Column({ name: "account_holder", type: "varchar", length: 180 })
  accountHolder!: string;

  @Column({ name: "is_primary", type: "boolean", default: true })
  isPrimary!: boolean;

  @OneToMany(() => BankTransferDetail, (detail) => detail.bankAccount)
  transferDetails!: BankTransferDetail[];
}
