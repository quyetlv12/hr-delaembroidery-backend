import { Column, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";
import { AttendanceLog } from "./AttendanceLog";
import { BankAccount } from "./BankAccount";
import { Department } from "./Department";
import { Position } from "./Position";
import { SalaryRecord } from "./SalaryRecord";
import { EmployeeSalaryHistory } from "./EmployeeSalaryHistory";
import { User } from "./User";

@Entity("employees")
export class Employee extends AppBaseEntity {
  @Column({ name: "employee_code", type: "varchar", unique: true, length: 50 })
  employeeCode!: string;

  @Column({ name: "timekeeping_code", type: "varchar", unique: true, nullable: true, length: 50 })
  timekeepingCode?: string | null;

  @Column({ name: "full_name", type: "varchar", length: 180 })
  fullName!: string;

  @Column({ name: "avatar_url", type: "varchar", nullable: true })
  avatarUrl?: string | null;

  @Column({ name: "avatar_public_id", type: "varchar", nullable: true })
  avatarPublicId?: string | null;

  @Column({ name: "avatar_uploaded_at", type: "datetime", nullable: true })
  avatarUploadedAt?: Date | null;

  @Column({ name: "gender", type: "varchar", length: 20 })
  gender!: string;

  @Column({ name: "birthday", type: "date", nullable: true })
  birthday?: string | null;

  @Column({ name: "email", type: "varchar", unique: true, length: 180 })
  email!: string;

  @Column({ name: "phone", type: "varchar", nullable: true, length: 40 })
  phone?: string | null;

  @Column({ name: "cccd", type: "varchar", nullable: true, length: 30 })
  cccd?: string | null;

  @Column({ name: "address", type: "text", nullable: true })
  address?: string | null;

  @Column({ name: "join_date", type: "date" })
  joinDate!: string;

  @Column({ name: "contract_type", type: "varchar", nullable: true, length: 80 })
  contractType?: string | null;

  @Column({ name: "shift_count", type: "int", default: 2 })
  shiftCount!: number;

  @Column({ name: "base_salary", type: "decimal", precision: 15, scale: 2, default: 0 })
  baseSalary!: string;

  @Column({ name: "tax_code", type: "varchar", nullable: true, length: 50 })
  taxCode?: string | null;

  @Column({ name: "insurance_code", type: "varchar", nullable: true, length: 50 })
  insuranceCode?: string | null;

  @Column({ name: "status", type: "varchar", length: 30, default: "active" })
  status!: string;

  @ManyToOne(() => Department, (department) => department.employees, { nullable: true })
  department?: Department | null;

  @ManyToOne(() => Position, (position) => position.employees, { nullable: true })
  position?: Position | null;

  @OneToOne(() => User, (user) => user.employee, { nullable: true })
  @JoinColumn({ name: "user_id" })
  user?: User | null;

  @OneToMany(() => BankAccount, (bankAccount) => bankAccount.employee)
  bankAccounts!: BankAccount[];

  @OneToMany(() => AttendanceLog, (attendanceLog) => attendanceLog.employee)
  attendanceLogs!: AttendanceLog[];

  @OneToMany(() => SalaryRecord, (salaryRecord) => salaryRecord.employee)
  salaryRecords!: SalaryRecord[];

  @OneToMany(() => EmployeeSalaryHistory, (history) => history.employee)
  salaryHistories!: EmployeeSalaryHistory[];
}
