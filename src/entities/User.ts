import { Column, Entity, JoinTable, ManyToMany, OneToOne } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";
import { Employee } from "./Employee";
import { Role } from "./Role";

@Entity("users")
export class User extends AppBaseEntity {
  @Column({ name: "login_code", type: "varchar", unique: true, length: 6 })
  loginCode!: string;

  @Column({ name: "email", type: "varchar", unique: true, length: 180 })
  email!: string;

  @Column({ name: "password_hash", type: "varchar", length: 255 })
  passwordHash!: string;

  @Column({ name: "full_name", type: "varchar", length: 180 })
  fullName!: string;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @OneToOne(() => Employee, (employee) => employee.user, { nullable: true })
  employee?: Employee | null;

  @ManyToMany(() => Role, (role) => role.users)
  @JoinTable({
    name: "user_roles",
    joinColumn: { name: "user_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "role_id", referencedColumnName: "id" },
  })
  roles!: Role[];
}
