import { Column, Entity, ManyToOne } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";
import { Employee } from "./Employee";

@Entity("attendance_logs")
export class AttendanceLog extends AppBaseEntity {
  @ManyToOne(() => Employee, (employee) => employee.attendanceLogs)
  employee!: Employee;

  @Column({ name: "source", type: "varchar", length: 40 })
  source!: string;

  @Column({ name: "work_date", type: "date" })
  workDate!: string;

  @Column({ name: "check_in_at", type: "datetime", nullable: true })
  checkInAt?: Date | null;

  @Column({ name: "check_out_at", type: "datetime", nullable: true })
  checkOutAt?: Date | null;

  @Column({ name: "raw_payload", type: "json", nullable: true })
  rawPayload?: Record<string, unknown> | null;
}
