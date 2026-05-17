import { Column, Entity } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";

@Entity("holidays")
export class Holiday extends AppBaseEntity {
  @Column({ name: "name", type: "varchar", length: 150 })
  name!: string;

  @Column({ name: "holiday_date", type: "date" })
  holidayDate!: string;

  @Column({ name: "is_paid", type: "boolean", default: true })
  isPaid!: boolean;

  @Column({ name: "bonus_amount", type: "decimal", precision: 15, scale: 2, default: 0 })
  bonusAmount!: string;
}
