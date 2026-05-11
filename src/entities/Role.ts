import { Column, Entity, JoinTable, ManyToMany } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";
import { Permission } from "./Permission";
import { User } from "./User";

@Entity("roles")
export class Role extends AppBaseEntity {
  @Column({ name: "name", type: "varchar", unique: true, length: 100 })
  name!: string;

  @Column({ name: "is_system", type: "boolean", default: false })
  isSystem!: boolean;

  @ManyToMany(() => Permission, (permission) => permission.roles, { cascade: true })
  @JoinTable({
    name: "role_permissions",
    joinColumn: { name: "role_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "permission_id", referencedColumnName: "id" },
  })
  permissions!: Permission[];

  @ManyToMany(() => User, (user) => user.roles)
  users!: User[];
}
