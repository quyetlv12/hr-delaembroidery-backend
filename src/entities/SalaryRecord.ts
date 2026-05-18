import { Column, Entity, ManyToOne, OneToMany } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";
import { Employee } from "./Employee";
import { SalaryDetail } from "./SalaryDetail";
import { SalaryEmailLog } from "./SalaryEmailLog";
import { SalaryPeriod } from "./SalaryPeriod";

@Entity("salary_records")
export class SalaryRecord extends AppBaseEntity {
  @ManyToOne(() => Employee, (employee) => employee.salaryRecords)
  employee!: Employee;

  @ManyToOne(() => SalaryPeriod, (salaryPeriod) => salaryPeriod.salaryRecords)
  salaryPeriod!: SalaryPeriod;

  @Column({ name: "base_salary", type: "decimal", precision: 15, scale: 2, default: 0 })
  baseSalary!: string;

  @Column({ name: "configured_salary", type: "decimal", precision: 15, scale: 2, default: 0 })
  configuredSalary!: string;

  @Column({ name: "insurance_salary", type: "decimal", precision: 15, scale: 2, default: 0 })
  insuranceSalary!: string;

  @Column({ name: "work_day", type: "decimal", precision: 5, scale: 2, default: 0 })
  workDay!: string;

  @Column({ name: "standard_work_day", type: "decimal", precision: 5, scale: 2, default: 0 })
  standardWorkDay!: string;

  @Column({ name: "fixed_daily_salary", type: "decimal", precision: 15, scale: 2, default: 0 })
  fixedDailySalary!: string;

  @Column({ name: "responsibility_allowance", type: "decimal", precision: 15, scale: 2, default: 0 })
  responsibilityAllowance!: string;

  @Column({ name: "meal_allowance", type: "decimal", precision: 15, scale: 2, default: 0 })
  mealAllowance!: string;

  @Column({ name: "phone_allowance", type: "decimal", precision: 15, scale: 2, default: 0 })
  phoneAllowance!: string;

  @Column({ name: "kpi_allowance", type: "decimal", precision: 15, scale: 2, default: 0 })
  kpiAllowance!: string;

  @Column({ name: "daily_total", type: "decimal", precision: 15, scale: 2, default: 0 })
  dailyTotal!: string;

  @Column({ name: "overtime_work_day", type: "decimal", precision: 5, scale: 2, default: 0 })
  overtimeWorkDay!: string;

  @Column({ name: "total_work_day", type: "decimal", precision: 5, scale: 2, default: 0 })
  totalWorkDay!: string;

  @Column({ name: "allowance_total", type: "decimal", precision: 15, scale: 2, default: 0 })
  allowanceTotal!: string;

  @Column({ name: "bonus_total", type: "decimal", precision: 15, scale: 2, default: 0 })
  bonusTotal!: string;

  @Column({ name: "bonus", type: "decimal", precision: 15, scale: 2, default: 0 })
  bonus!: string;

  @Column({ name: "overtime_total", type: "decimal", precision: 15, scale: 2, default: 0 })
  overtimeTotal!: string;

  @Column({ name: "gross_salary", type: "decimal", precision: 15, scale: 2, default: 0 })
  grossSalary!: string;

  @Column({ name: "employer_insurance_total", type: "decimal", precision: 15, scale: 2, default: 0 })
  employerInsuranceTotal!: string;

  @Column({ name: "insurance_total", type: "decimal", precision: 15, scale: 2, default: 0 })
  insuranceTotal!: string;

  @Column({ name: "total_insurance", type: "decimal", precision: 15, scale: 2, default: 0 })
  totalInsurance!: string;

  @Column({ name: "tax_total", type: "decimal", precision: 15, scale: 2, default: 0 })
  taxTotal!: string;

  @Column({ name: "advance_total", type: "decimal", precision: 15, scale: 2, default: 0 })
  advanceTotal!: string;

  @Column({ name: "deduction_total", type: "decimal", precision: 15, scale: 2, default: 0 })
  deductionTotal!: string;

  @Column({ name: "net_salary", type: "decimal", precision: 15, scale: 2, default: 0 })
  netSalary!: string;

  @Column({ name: "status", type: "varchar", length: 30, default: "draft" })
  status!: string;

  @OneToMany(() => SalaryDetail, (salaryDetail) => salaryDetail.salaryRecord)
  details!: SalaryDetail[];

  @OneToMany(() => SalaryEmailLog, (emailLog) => emailLog.salaryRecord)
  emailLogs!: SalaryEmailLog[];
}
