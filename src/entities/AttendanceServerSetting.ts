import { Column, Entity } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";

@Entity("attendance_server_settings")
export class AttendanceServerSetting extends AppBaseEntity {
  @Column({ name: "attendance_endpoint", type: "varchar", length: 255 })
  attendanceEndpoint!: string;

  @Column({ name: "staff_endpoint", type: "varchar", length: 255 })
  staffEndpoint!: string;

  @Column({ name: "session_cookie", type: "text" })
  sessionCookie!: string;

  @Column({ name: "updated_by_user_id", type: "varchar", length: 36, nullable: true })
  updatedByUserId?: string | null;

  @Column({ name: "updated_by_login_code", type: "varchar", length: 50, nullable: true })
  updatedByLoginCode?: string | null;

  @Column({ name: "auto_sync_enabled", type: "boolean", default: false })
  autoSyncEnabled!: boolean;

  @Column({ name: "auto_sync_month_data_id", type: "varchar", length: 60, default: "" })
  autoSyncMonthDataId!: string;

  @Column({ name: "auto_sync_month_mappings", type: "json", nullable: true })
  autoSyncMonthMappings?: Array<{ period: string; monthDataId: string }> | null;

  @Column({ name: "auto_sync_start_offset_minutes", type: "int", default: 60 })
  autoSyncStartOffsetMinutes!: number;

  @Column({ name: "auto_sync_window_minutes", type: "int", default: 60 })
  autoSyncWindowMinutes!: number;

  @Column({ name: "auto_sync_interval_minutes", type: "int", default: 10 })
  autoSyncIntervalMinutes!: number;

  @Column({ name: "auto_sync_last_run_at", type: "datetime", nullable: true })
  autoSyncLastRunAt?: Date | null;

  @Column({ name: "auto_sync_last_status", type: "varchar", length: 30, nullable: true })
  autoSyncLastStatus?: string | null;

  @Column({ name: "auto_sync_last_message", type: "varchar", length: 255, nullable: true })
  autoSyncLastMessage?: string | null;
}
