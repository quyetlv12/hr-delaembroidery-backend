import { Column, Entity } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";

@Entity("attendance_settings")
export class AttendanceSetting extends AppBaseEntity {
  @Column({ name: "morning_start", type: "varchar", length: 5, default: "07:30" })
  morningStart!: string;

  @Column({ name: "morning_end", type: "varchar", length: 5, default: "11:30" })
  morningEnd!: string;

  @Column({ name: "afternoon_start", type: "varchar", length: 5, default: "13:30" })
  afternoonStart!: string;

  @Column({ name: "afternoon_end", type: "varchar", length: 5, default: "17:30" })
  afternoonEnd!: string;

  @Column({ name: "overtime_rate", type: "decimal", precision: 5, scale: 2, default: 1.5 })
  overtimeRate!: string;
}
