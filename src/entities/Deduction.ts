import { Column, Entity, ManyToOne } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";
import { Employee } from "./Employee";

@Entity("deductions")
export class Deduction extends AppBaseEntity {
  @ManyToOne(() => Employee)
  employee!: Employee;

  @Column({ name: "name", type: "varchar", length: 150 })
  name!: string;

  @Column({ name: "amount", type: "decimal", precision: 15, scale: 2, default: 0 })
  amount!: string;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;
}
