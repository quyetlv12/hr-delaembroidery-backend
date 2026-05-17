import { Column, Entity } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";

type PayrollFormulaSnapshot = {
  insuranceBaseSalary: number;
  employeeInsuranceRate: number;
  employerInsuranceRate: number;
  defaultMealAllowance: number;
  defaultPhoneAllowance: number;
  columnFormulas: Array<{
    key: string;
    name: string;
    formula: string;
  }>;
};

@Entity("payroll_formula_templates")
export class PayrollFormulaTemplate extends AppBaseEntity {
  @Column({ name: "name", type: "varchar", length: 120 })
  name!: string;

  @Column({ name: "description", type: "varchar", length: 255, nullable: true })
  description?: string | null;

  @Column({ name: "created_by_user_id", type: "varchar", length: 36, nullable: true })
  createdByUserId?: string | null;

  @Column({ name: "created_by_login_code", type: "varchar", length: 50, nullable: true })
  createdByLoginCode?: string | null;

  @Column({ name: "snapshot", type: "json" })
  snapshot!: PayrollFormulaSnapshot;
}
