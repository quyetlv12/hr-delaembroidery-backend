import { Column, Entity, OneToMany } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";
import { SalaryRecord } from "./SalaryRecord";

@Entity("salary_periods")
export class SalaryPeriod extends AppBaseEntity {
  @Column({ name: "month", type: "int" })
  month!: number;

  @Column({ name: "year", type: "int" })
  year!: number;

  @Column({ name: "status", type: "varchar", length: 30, default: "draft" })
  status!: string;

  @Column({ name: "locked_at", type: "datetime", nullable: true })
  lockedAt?: Date | null;

  @OneToMany(() => SalaryRecord, (salaryRecord) => salaryRecord.salaryPeriod)
  salaryRecords!: SalaryRecord[];
}
