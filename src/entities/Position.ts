import { Column, Entity, ManyToOne, OneToMany } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";
import { Department } from "./Department";
import { Employee } from "./Employee";

@Entity("positions")
export class Position extends AppBaseEntity {
  @Column({ name: "code", type: "varchar", unique: true, length: 50 })
  code!: string;

  @Column({ name: "name", type: "varchar", length: 150 })
  name!: string;

  @ManyToOne(() => Department, (department) => department.positions, { nullable: true })
  department?: Department | null;

  @OneToMany(() => Employee, (employee) => employee.position)
  employees!: Employee[];
}
