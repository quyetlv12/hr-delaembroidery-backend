import { Column, Entity, ManyToOne } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";
import { Employee } from "./Employee";
import { User } from "./User";

@Entity("leave_requests")
export class LeaveRequest extends AppBaseEntity {
  @ManyToOne(() => Employee)
  employee!: Employee;

  @Column({ name: "leave_type", type: "varchar", length: 80 })
  leaveType!: string;

  @Column({ name: "start_date", type: "date" })
  startDate!: string;

  @Column({ name: "end_date", type: "date" })
  endDate!: string;

  @Column({ name: "reason", type: "text", nullable: true })
  reason?: string | null;

  @Column({ name: "status", type: "varchar", length: 30, default: "pending" })
  status!: string;

  @ManyToOne(() => User, { nullable: true })
  approvedBy?: User | null;
}
