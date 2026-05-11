import { Column, Entity, OneToMany } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";
import { Employee } from "./Employee";
import { Position } from "./Position";

@Entity("departments")
export class Department extends AppBaseEntity {
  @Column({ name: "code", type: "varchar", unique: true, length: 50 })
  code!: string;

  @Column({ name: "name", type: "varchar", length: 150 })
  name!: string;

  @Column({ name: "description", type: "text", nullable: true })
  description?: string | null;

  @OneToMany(() => Position, (position) => position.department)
  positions!: Position[];

  @OneToMany(() => Employee, (employee) => employee.department)
  employees!: Employee[];
}
