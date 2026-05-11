import { Column, Entity, ManyToMany } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";
import { Role } from "./Role";

@Entity("permissions")
export class Permission extends AppBaseEntity {
  @Column({ name: "code", type: "varchar", unique: true, length: 100 })
  code!: string;

  @Column({ name: "module", type: "varchar", length: 80 })
  module!: string;

  @Column({ name: "action", type: "varchar", length: 80 })
  action!: string;

  @ManyToMany(() => Role, (role) => role.permissions)
  roles!: Role[];
}
