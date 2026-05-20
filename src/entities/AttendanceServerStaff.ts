import { Column, Entity, Index } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";

@Entity("attendance_server_staff")
export class AttendanceServerStaff extends AppBaseEntity {
  @Index("IDX_attendance_server_staff_yunatt_id")
  @Column({ name: "yunatt_id", type: "varchar", length: 80, nullable: true })
  yunattId?: string | null;

  @Index("IDX_attendance_server_staff_enrollid")
  @Column({ name: "enrollid", type: "varchar", length: 80, nullable: true })
  enrollid?: string | null;

  @Index("IDX_attendance_server_staff_staff_number")
  @Column({ name: "staff_number", type: "varchar", length: 80, nullable: true })
  staffNumber?: string | null;

  @Index("IDX_attendance_server_staff_name")
  @Column({ name: "name", type: "varchar", length: 180, nullable: true })
  name?: string | null;

  @Column({ name: "id_number", type: "varchar", length: 80, nullable: true })
  idNumber?: string | null;

  @Column({ name: "ic_card", type: "varchar", length: 120, nullable: true })
  icCard?: string | null;

  @Column({ name: "mobile", type: "varchar", length: 80, nullable: true })
  mobile?: string | null;

  @Column({ name: "punch_pwd", type: "varchar", length: 120, nullable: true })
  punchPwd?: string | null;

  @Column({ name: "department_id", type: "varchar", length: 80, nullable: true })
  departmentId?: string | null;

  @Column({ name: "department_name", type: "varchar", length: 180, nullable: true })
  departmentName?: string | null;

  @Column({ name: "staff_type_id", type: "varchar", length: 80, nullable: true })
  staffTypeId?: string | null;

  @Column({ name: "staff_type", type: "varchar", length: 120, nullable: true })
  staffType?: string | null;

  @Column({ name: "staff_date", type: "varchar", length: 80, nullable: true })
  staffDate?: string | null;

  @Column({ name: "staff_status", type: "int", nullable: true })
  staffStatus?: number | null;

  @Column({ name: "sex", type: "int", nullable: true })
  sex?: number | null;

  @Column({ name: "station_id", type: "varchar", length: 80, nullable: true })
  stationId?: string | null;

  @Column({ name: "station", type: "varchar", length: 180, nullable: true })
  station?: string | null;

  @Column({ name: "address", type: "varchar", length: 255, nullable: true })
  address?: string | null;

  @Column({ name: "degree_id", type: "varchar", length: 80, nullable: true })
  degreeId?: string | null;

  @Column({ name: "degree", type: "varchar", length: 120, nullable: true })
  degree?: string | null;

  @Column({ name: "email", type: "varchar", length: 180, nullable: true })
  email?: string | null;

  @Column({ name: "phone", type: "varchar", length: 80, nullable: true })
  phone?: string | null;

  @Column({ name: "remark", type: "varchar", length: 255, nullable: true })
  remark?: string | null;

  @Column({ name: "app_login", type: "boolean", default: false })
  appLogin!: boolean;

  @Column({ name: "punch", type: "boolean", default: false })
  punch!: boolean;

  @Column({ name: "senior", type: "boolean", default: false })
  senior!: boolean;

  @Column({ name: "admin", type: "boolean", default: false })
  admin!: boolean;

  @Column({ name: "super_admin", type: "boolean", default: false })
  superAdmin!: boolean;

  @Column({ name: "leave_flag", type: "boolean", default: false })
  leave!: boolean;

  @Column({ name: "leave_type", type: "varchar", length: 120, nullable: true })
  leaveType?: string | null;

  @Column({ name: "leave_date", type: "varchar", length: 80, nullable: true })
  leaveDate?: string | null;

  @Column({ name: "leave_reason", type: "varchar", length: 255, nullable: true })
  leaveReason?: string | null;

  @Column({ name: "photo", type: "varchar", length: 500, nullable: true })
  photo?: string | null;

  @Column({ name: "need_app", type: "varchar", length: 20, nullable: true })
  needApp?: string | null;

  @Column({ name: "customer_id", type: "varchar", length: 80, nullable: true })
  customerId?: string | null;

  @Column({ name: "gmt_create", type: "varchar", length: 80, nullable: true })
  gmtCreate?: string | null;

  @Column({ name: "gmt_modified", type: "varchar", length: 80, nullable: true })
  gmtModified?: string | null;

  @Column({ name: "finger_num", type: "int", nullable: true })
  fingerNum?: number | null;

  @Column({ name: "face_num", type: "int", nullable: true })
  faceNum?: number | null;

  @Column({ name: "pic_num", type: "int", nullable: true })
  picNum?: number | null;

  @Column({ name: "attence_machine_ids", type: "varchar", length: 255, nullable: true })
  attenceMachineIds?: string | null;

  @Column({ name: "device_names", type: "varchar", length: 255, nullable: true })
  deviceNames?: string | null;

  @Column({ name: "group_names", type: "varchar", length: 255, nullable: true })
  groupNames?: string | null;

  @Column({ name: "raw_payload", type: "longtext", nullable: true })
  rawPayload?: string | null;

  @Column({ name: "last_synced_at", type: "datetime", nullable: true })
  lastSyncedAt?: Date | null;

  @Column({ name: "synced_by_user_id", type: "varchar", length: 36, nullable: true })
  syncedByUserId?: string | null;

  @Column({ name: "synced_by_login_code", type: "varchar", length: 50, nullable: true })
  syncedByLoginCode?: string | null;
}
