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

  @Column({ name: "night_start", type: "varchar", length: 5, default: "18:00" })
  nightStart!: string;

  @Column({ name: "night_end", type: "varchar", length: 5, default: "21:00" })
  nightEnd!: string;

  @Column({ name: "overtime_rate", type: "decimal", precision: 5, scale: 2, default: 1.5 })
  overtimeRate!: string;

  @Column({ name: "holiday_rate", type: "decimal", precision: 5, scale: 2, default: 2 })
  holidayRate!: string;

  @Column({ name: "weekly_days_off", type: "varchar", length: 30, default: "0" })
  weeklyDaysOff!: string;
}
