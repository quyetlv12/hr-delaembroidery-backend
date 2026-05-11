import { Column, Entity, Index } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";

@Entity("attendance_month_settings")
@Index(["year", "month"], { unique: true })
export class AttendanceMonthSetting extends AppBaseEntity {
  @Column({ name: "month", type: "int" })
  month!: number;

  @Column({ name: "year", type: "int" })
  year!: number;

  @Column({ name: "standard_work_day", type: "decimal", precision: 5, scale: 2, default: 0 })
  standardWorkDay!: string;

  @Column({ name: "holiday_paid_days", type: "decimal", precision: 5, scale: 2, default: 0 })
  holidayPaidDays!: string;

  @Column({ name: "holiday_bonus_amount", type: "decimal", precision: 15, scale: 2, default: 0 })
  holidayBonusAmount!: string;
}
