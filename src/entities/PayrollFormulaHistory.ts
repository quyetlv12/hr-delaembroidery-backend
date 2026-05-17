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

@Entity("payroll_formula_histories")
export class PayrollFormulaHistory extends AppBaseEntity {
  @Column({ name: "action", type: "varchar", length: 30, default: "update" })
  action!: string;

  @Column({ name: "change_note", type: "varchar", length: 255, nullable: true })
  changeNote?: string | null;

  @Column({ name: "changed_by_user_id", type: "varchar", length: 36, nullable: true })
  changedByUserId?: string | null;

  @Column({ name: "changed_by_login_code", type: "varchar", length: 50, nullable: true })
  changedByLoginCode?: string | null;

  @Column({ name: "snapshot", type: "json" })
  snapshot!: PayrollFormulaSnapshot;
}
