import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex, type TableColumnOptions } from "typeorm";

export class CreateAttendanceServerStaff20260519113000 implements MigrationInterface {
  name = "CreateAttendanceServerStaff20260519113000";

  async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable("attendance_server_staff");
    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: "attendance_server_staff",
          columns: [
            { name: "id", type: "varchar", length: "36", isPrimary: true },
            { name: "yunatt_id", type: "varchar", length: "80", isNullable: true },
            { name: "enrollid", type: "varchar", length: "80", isNullable: true },
            { name: "staff_number", type: "varchar", length: "80", isNullable: true },
            { name: "name", type: "varchar", length: "180", isNullable: true },
            { name: "id_number", type: "varchar", length: "80", isNullable: true },
            { name: "ic_card", type: "varchar", length: "120", isNullable: true },
            { name: "mobile", type: "varchar", length: "80", isNullable: true },
            { name: "punch_pwd", type: "varchar", length: "120", isNullable: true },
            { name: "department_id", type: "varchar", length: "80", isNullable: true },
            { name: "department_name", type: "varchar", length: "180", isNullable: true },
            { name: "staff_type_id", type: "varchar", length: "80", isNullable: true },
            { name: "staff_type", type: "varchar", length: "120", isNullable: true },
            { name: "staff_date", type: "varchar", length: "80", isNullable: true },
            { name: "staff_status", type: "int", isNullable: true },
            { name: "sex", type: "int", isNullable: true },
            { name: "station_id", type: "varchar", length: "80", isNullable: true },
            { name: "station", type: "varchar", length: "180", isNullable: true },
            { name: "address", type: "varchar", length: "255", isNullable: true },
            { name: "degree_id", type: "varchar", length: "80", isNullable: true },
            { name: "degree", type: "varchar", length: "120", isNullable: true },
            { name: "email", type: "varchar", length: "180", isNullable: true },
            { name: "phone", type: "varchar", length: "80", isNullable: true },
            { name: "remark", type: "varchar", length: "255", isNullable: true },
            { name: "app_login", type: "tinyint", width: 1, default: 0 },
            { name: "punch", type: "tinyint", width: 1, default: 0 },
            { name: "senior", type: "tinyint", width: 1, default: 0 },
            { name: "admin", type: "tinyint", width: 1, default: 0 },
            { name: "super_admin", type: "tinyint", width: 1, default: 0 },
            { name: "leave_flag", type: "tinyint", width: 1, default: 0 },
            { name: "leave_type", type: "varchar", length: "120", isNullable: true },
            { name: "leave_date", type: "varchar", length: "80", isNullable: true },
            { name: "leave_reason", type: "varchar", length: "255", isNullable: true },
            { name: "photo", type: "varchar", length: "500", isNullable: true },
            { name: "need_app", type: "varchar", length: "20", isNullable: true },
            { name: "customer_id", type: "varchar", length: "80", isNullable: true },
            { name: "gmt_create", type: "varchar", length: "80", isNullable: true },
            { name: "gmt_modified", type: "varchar", length: "80", isNullable: true },
            { name: "finger_num", type: "int", isNullable: true },
            { name: "face_num", type: "int", isNullable: true },
            { name: "pic_num", type: "int", isNullable: true },
            { name: "attence_machine_ids", type: "varchar", length: "255", isNullable: true },
            { name: "device_names", type: "varchar", length: "255", isNullable: true },
            { name: "group_names", type: "varchar", length: "255", isNullable: true },
            { name: "raw_payload", type: "longtext", isNullable: true },
            { name: "last_synced_at", type: "datetime", isNullable: true },
            { name: "synced_by_user_id", type: "varchar", length: "36", isNullable: true },
            { name: "synced_by_login_code", type: "varchar", length: "50", isNullable: true },
            { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
            { name: "updated_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
            { name: "deleted_at", type: "datetime", isNullable: true },
          ],
        }),
        true,
      );
    } else {
      for (const column of attendanceServerStaffColumns) {
        await ensureColumn(queryRunner, "attendance_server_staff", column.name, column);
      }
    }

    await ensureIndex(queryRunner, "attendance_server_staff", "IDX_attendance_server_staff_staff_number", [
      "staff_number",
    ]);
    await ensureIndex(queryRunner, "attendance_server_staff", "IDX_attendance_server_staff_yunatt_id", ["yunatt_id"]);
    await ensureIndex(queryRunner, "attendance_server_staff", "IDX_attendance_server_staff_enrollid", ["enrollid"]);
    await ensureIndex(queryRunner, "attendance_server_staff", "IDX_attendance_server_staff_name", ["name"]);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("attendance_server_staff", true);
  }
}

const attendanceServerStaffColumns: TableColumnOptions[] = [
  { name: "id", type: "varchar", length: "36", isPrimary: true },
  { name: "yunatt_id", type: "varchar", length: "80", isNullable: true },
  { name: "enrollid", type: "varchar", length: "80", isNullable: true },
  { name: "staff_number", type: "varchar", length: "80", isNullable: true },
  { name: "name", type: "varchar", length: "180", isNullable: true },
  { name: "id_number", type: "varchar", length: "80", isNullable: true },
  { name: "ic_card", type: "varchar", length: "120", isNullable: true },
  { name: "mobile", type: "varchar", length: "80", isNullable: true },
  { name: "punch_pwd", type: "varchar", length: "120", isNullable: true },
  { name: "department_id", type: "varchar", length: "80", isNullable: true },
  { name: "department_name", type: "varchar", length: "180", isNullable: true },
  { name: "staff_type_id", type: "varchar", length: "80", isNullable: true },
  { name: "staff_type", type: "varchar", length: "120", isNullable: true },
  { name: "staff_date", type: "varchar", length: "80", isNullable: true },
  { name: "staff_status", type: "int", isNullable: true },
  { name: "sex", type: "int", isNullable: true },
  { name: "station_id", type: "varchar", length: "80", isNullable: true },
  { name: "station", type: "varchar", length: "180", isNullable: true },
  { name: "address", type: "varchar", length: "255", isNullable: true },
  { name: "degree_id", type: "varchar", length: "80", isNullable: true },
  { name: "degree", type: "varchar", length: "120", isNullable: true },
  { name: "email", type: "varchar", length: "180", isNullable: true },
  { name: "phone", type: "varchar", length: "80", isNullable: true },
  { name: "remark", type: "varchar", length: "255", isNullable: true },
  { name: "app_login", type: "tinyint", width: 1, default: 0 },
  { name: "punch", type: "tinyint", width: 1, default: 0 },
  { name: "senior", type: "tinyint", width: 1, default: 0 },
  { name: "admin", type: "tinyint", width: 1, default: 0 },
  { name: "super_admin", type: "tinyint", width: 1, default: 0 },
  { name: "leave_flag", type: "tinyint", width: 1, default: 0 },
  { name: "leave_type", type: "varchar", length: "120", isNullable: true },
  { name: "leave_date", type: "varchar", length: "80", isNullable: true },
  { name: "leave_reason", type: "varchar", length: "255", isNullable: true },
  { name: "photo", type: "varchar", length: "500", isNullable: true },
  { name: "need_app", type: "varchar", length: "20", isNullable: true },
  { name: "customer_id", type: "varchar", length: "80", isNullable: true },
  { name: "gmt_create", type: "varchar", length: "80", isNullable: true },
  { name: "gmt_modified", type: "varchar", length: "80", isNullable: true },
  { name: "finger_num", type: "int", isNullable: true },
  { name: "face_num", type: "int", isNullable: true },
  { name: "pic_num", type: "int", isNullable: true },
  { name: "attence_machine_ids", type: "varchar", length: "255", isNullable: true },
  { name: "device_names", type: "varchar", length: "255", isNullable: true },
  { name: "group_names", type: "varchar", length: "255", isNullable: true },
  { name: "raw_payload", type: "longtext", isNullable: true },
  { name: "last_synced_at", type: "datetime", isNullable: true },
  { name: "synced_by_user_id", type: "varchar", length: "36", isNullable: true },
  { name: "synced_by_login_code", type: "varchar", length: "50", isNullable: true },
  { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
  { name: "updated_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
  { name: "deleted_at", type: "datetime", isNullable: true },
];

async function ensureColumn(
  queryRunner: QueryRunner,
  tableName: string,
  columnName: string,
  column: TableColumnOptions,
) {
  const hasColumn = await queryRunner.hasColumn(tableName, columnName);
  if (!hasColumn) {
    await queryRunner.addColumn(tableName, new TableColumn(column));
  }
}

async function ensureIndex(queryRunner: QueryRunner, tableName: string, indexName: string, columnNames: string[]) {
  const table = await queryRunner.getTable(tableName);
  const hasIndex = table?.indices.some(
    (index) => index.name === indexName || columnNames.every((column) => index.columnNames.includes(column)),
  );
  if (!hasIndex) {
    await queryRunner.createIndex(tableName, new TableIndex({ name: indexName, columnNames }));
  }
}
