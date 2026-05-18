import { Column, Entity, ManyToOne } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";
import { Employee } from "./Employee";

@Entity("employee_monthly_bonus_histories")
export class EmployeeMonthlyBonusHistory extends AppBaseEntity {
  @ManyToOne(() => Employee, { onDelete: "CASCADE" })
  employee!: Employee;

  @Column({ name: "month", type: "int" })
  month!: number;

  @Column({ name: "year", type: "int" })
  year!: number;

  @Column({ name: "previous_bonus", type: "decimal", precision: 15, scale: 2, default: 0 })
  previousBonus!: string;

  @Column({ name: "new_bonus", type: "decimal", precision: 15, scale: 2, default: 0 })
  newBonus!: string;

  @Column({ name: "changed_by_user_id", type: "varchar", length: 36, nullable: true })
  changedByUserId?: string | null;

  @Column({ name: "changed_by_login_code", type: "varchar", length: 50, nullable: true })
  changedByLoginCode?: string | null;
}
