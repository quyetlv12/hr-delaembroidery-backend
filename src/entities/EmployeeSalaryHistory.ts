import { Column, Entity, ManyToOne } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";
import { Employee } from "./Employee";

@Entity("employee_salary_histories")
export class EmployeeSalaryHistory extends AppBaseEntity {
  @ManyToOne(() => Employee)
  employee!: Employee;

  @Column({ name: "previous_salary", type: "decimal", precision: 15, scale: 2 })
  previousSalary!: string;

  @Column({ name: "new_salary", type: "decimal", precision: 15, scale: 2 })
  newSalary!: string;

  @Column({ name: "change_amount", type: "decimal", precision: 15, scale: 2 })
  changeAmount!: string;

  @Column({ name: "change_percent", type: "decimal", precision: 8, scale: 4, nullable: true })
  changePercent?: string | null;

  @Column({ name: "change_source", type: "varchar", length: 50 })
  changeSource!: string;

  @Column({ name: "change_mode", type: "varchar", length: 30, nullable: true })
  changeMode?: string | null;

  @Column({ name: "change_value", type: "decimal", precision: 15, scale: 2, nullable: true })
  changeValue?: string | null;

  @Column({ name: "changed_by_user_id", type: "varchar", length: 36, nullable: true })
  changedByUserId?: string | null;

  @Column({ name: "changed_by_login_code", type: "varchar", length: 50, nullable: true })
  changedByLoginCode?: string | null;
}
