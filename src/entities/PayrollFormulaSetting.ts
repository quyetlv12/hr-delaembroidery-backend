import { Column, Entity } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";

type PayrollFormulaCategorySetting = {
  key: string;
  name: string;
  formula: string;
};

@Entity("payroll_formula_settings")
export class PayrollFormulaSetting extends AppBaseEntity {
  @Column({ name: "insurance_base_salary", type: "decimal", precision: 15, scale: 2, default: 5062000 })
  insuranceBaseSalary!: string;

  @Column({ name: "employee_insurance_rate", type: "decimal", precision: 7, scale: 4, default: 10.5 })
  employeeInsuranceRate!: string;

  @Column({ name: "employer_insurance_rate", type: "decimal", precision: 7, scale: 4, default: 21.5 })
  employerInsuranceRate!: string;

  @Column({ name: "earning_categories", type: "json", nullable: true })
  earningCategories?: PayrollFormulaCategorySetting[] | string[] | null;

  @Column({ name: "deduction_categories", type: "json", nullable: true })
  deductionCategories?: PayrollFormulaCategorySetting[] | string[] | null;

  @Column({ name: "daily_salary_formula", type: "text" })
  dailySalaryFormula!: string;

  @Column({ name: "gross_salary_formula", type: "text" })
  grossSalaryFormula!: string;

  @Column({ name: "deduction_formula", type: "text" })
  deductionFormula!: string;

  @Column({ name: "net_salary_formula", type: "text" })
  netSalaryFormula!: string;
}
