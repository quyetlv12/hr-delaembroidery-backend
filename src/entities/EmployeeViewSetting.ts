import { Column, Entity } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";

@Entity("employee_view_settings")
export class EmployeeViewSetting extends AppBaseEntity {
  @Column({ name: "payroll_columns", type: "json", nullable: true })
  payrollColumns?: string[] | null;

  @Column({ name: "attendance_columns", type: "json", nullable: true })
  attendanceColumns?: string[] | null;
}
