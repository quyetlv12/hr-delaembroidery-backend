import { Column, Entity, ManyToOne } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";
import { Employee } from "./Employee";

@Entity("attendance_summary")
export class AttendanceSummary extends AppBaseEntity {
  @ManyToOne(() => Employee)
  employee!: Employee;

  @Column({ name: "work_date", type: "date" })
  workDate!: string;

  @Column({ name: "check_in_at", type: "datetime", nullable: true })
  checkInAt?: Date | null;

  @Column({ name: "check_out_at", type: "datetime", nullable: true })
  checkOutAt?: Date | null;

  @Column({ name: "morning_check_in_at", type: "datetime", nullable: true })
  morningCheckInAt?: Date | null;

  @Column({ name: "morning_check_out_at", type: "datetime", nullable: true })
  morningCheckOutAt?: Date | null;

  @Column({ name: "afternoon_check_in_at", type: "datetime", nullable: true })
  afternoonCheckInAt?: Date | null;

  @Column({ name: "afternoon_check_out_at", type: "datetime", nullable: true })
  afternoonCheckOutAt?: Date | null;

  @Column({ name: "night_check_in_at", type: "datetime", nullable: true })
  nightCheckInAt?: Date | null;

  @Column({ name: "night_check_out_at", type: "datetime", nullable: true })
  nightCheckOutAt?: Date | null;

  @Column({ name: "late_minutes", type: "int", default: 0 })
  lateMinutes!: number;

  @Column({ name: "early_leave_minutes", type: "int", default: 0 })
  earlyLeaveMinutes!: number;

  @Column({ name: "overtime_minutes", type: "int", default: 0 })
  overtimeMinutes!: number;

  @Column({ name: "work_day", type: "decimal", precision: 4, scale: 2, default: 0 })
  workDay!: string;

  @Column({ name: "status", type: "varchar", length: 40, default: "present" })
  status!: string;
}
