import { Column, Entity, ManyToOne } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";
import { Employee } from "./Employee";
import { SalaryPeriod } from "./SalaryPeriod";
import { SalaryRecord } from "./SalaryRecord";

export type PayrollRecordSnapshot = {
  configuredSalary: number;
  insuranceSalary: number;
  workDay: number;
  standardWorkDay: number;
  fixedDailySalary: number;
  responsibilityAllowance: number;
  mealAllowance: number;
  phoneAllowance: number;
  kpiAllowance: number;
  dailyTotal: number;
  overtimeWorkDay: number;
  totalWorkDay: number;
  earnedSalary: number;
  allowanceTotal: number;
  bonusTotal: number;
  bonus: number;
  overtimeTotal: number;
  grossSalary: number;
  employerInsuranceTotal: number;
  insuranceTotal: number;
  totalInsurance: number;
  taxTotal: number;
  advanceTotal: number;
  deductionTotal: number;
  netSalary: number;
  status: string;
};

@Entity("payroll_record_histories")
export class PayrollRecordHistory extends AppBaseEntity {
  @ManyToOne(() => SalaryPeriod)
  salaryPeriod!: SalaryPeriod;

  @ManyToOne(() => SalaryRecord)
  salaryRecord!: SalaryRecord;

  @ManyToOne(() => Employee)
  employee!: Employee;

  @Column({ name: "action", type: "varchar", length: 30, default: "update" })
  action!: string;

  @Column({ name: "requested_fields", type: "json" })
  requestedFields!: string[];

  @Column({ name: "changed_fields", type: "json" })
  changedFields!: string[];

  @Column({ name: "previous_snapshot", type: "json" })
  previousSnapshot!: PayrollRecordSnapshot;

  @Column({ name: "next_snapshot", type: "json" })
  nextSnapshot!: PayrollRecordSnapshot;

  @Column({ name: "changed_by_user_id", type: "varchar", length: 36, nullable: true })
  changedByUserId?: string | null;

  @Column({ name: "changed_by_login_code", type: "varchar", length: 50, nullable: true })
  changedByLoginCode?: string | null;
}
