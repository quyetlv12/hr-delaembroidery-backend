import { Column, Entity, ManyToOne } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";
import { Employee } from "./Employee";
import { SalaryRecord } from "./SalaryRecord";
import { SalaryPeriod } from "./SalaryPeriod";
import { User } from "./User";

@Entity("salary_email_logs")
export class SalaryEmailLog extends AppBaseEntity {
  @ManyToOne(() => Employee)
  employee!: Employee;

  @ManyToOne(() => SalaryPeriod)
  salaryPeriod!: SalaryPeriod;

  @ManyToOne(() => SalaryRecord, (salaryRecord) => salaryRecord.emailLogs)
  salaryRecord!: SalaryRecord;

  @Column({ name: "email", type: "varchar", length: 180 })
  email!: string;

  @Column({ name: "status", type: "varchar", length: 30 })
  status!: string;

  @Column({ name: "sent_at", type: "datetime", nullable: true })
  sentAt?: Date | null;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage?: string | null;

  @ManyToOne(() => User, { nullable: true })
  sentBy?: User | null;
}
