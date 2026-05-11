import { Column, Entity, ManyToOne } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";
import { SalaryRecord } from "./SalaryRecord";

@Entity("salary_details")
export class SalaryDetail extends AppBaseEntity {
  @ManyToOne(() => SalaryRecord, (salaryRecord) => salaryRecord.details)
  salaryRecord!: SalaryRecord;

  @Column({ name: "type", type: "varchar", length: 40 })
  type!: string;

  @Column({ name: "label", type: "varchar", length: 150 })
  label!: string;

  @Column({ name: "amount", type: "decimal", precision: 15, scale: 2, default: 0 })
  amount!: string;
}
