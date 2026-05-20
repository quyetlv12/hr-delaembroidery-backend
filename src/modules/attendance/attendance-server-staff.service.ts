import { AppDataSource } from "../../database/data-source";
import { AttendanceServerStaff } from "../../entities";
import type { AttendanceServerStaffListDto, AttendanceServerSavedStaffListDto } from "./attendance.dto";
import { AttendanceServerSyncTestService, type AttendanceServerStaffRow } from "./attendance-server-sync-test.service";

type CurrentUser = {
  id: string;
  loginCode: string;
};

type RawStaffPayload = Record<string, unknown>;

export type AttendanceServerSavedStaffRow = {
  id: string;
  yunattId: string;
  enrollid: string;
  staffNumber: string;
  name: string;
  idNumber: string;
  icCard: string;
  mobile: string;
  punchPwd: string;
  departmentId: string;
  departmentName: string;
  staffTypeId: string;
  staffType: string;
  staffDate: string;
  staffStatus: number | null;
  sex: number | null;
  stationId: string;
  station: string;
  address: string;
  degreeId: string;
  degree: string;
  email: string;
  phone: string;
  remark: string;
  appLogin: boolean;
  punch: boolean;
  senior: boolean;
  admin: boolean;
  superAdmin: boolean;
  leave: boolean;
  leaveType: string;
  leaveDate: string;
  leaveReason: string;
  photo: string;
  needApp: string;
  customerId: string;
  gmtCreate: string;
  gmtModified: string;
  fingerNum: number | null;
  faceNum: number | null;
  picNum: number | null;
  attenceMachineIds: string;
  deviceNames: string;
  groupNames: string;
  rawPayload: RawStaffPayload | null;
  lastSyncedAt: string | null;
  syncedByLoginCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AttendanceServerSavedStaffListResult = {
  offset: number;
  limit: number;
  search: string;
  total: number;
  rows: AttendanceServerSavedStaffRow[];
};

export type AttendanceServerStaffSyncResult = {
  requested: {
    endpoint: string;
    sort: string;
    order: "asc" | "desc";
    offset: number;
    limit: number;
    search: string;
  };
  total: number;
  fetchedRows: number;
  savedRows: number;
  rows: AttendanceServerSavedStaffRow[];
};

export class AttendanceServerStaffService {
  private readonly repository = AppDataSource.getRepository(AttendanceServerStaff);
  private readonly liveStaffService = new AttendanceServerSyncTestService();

  async list(input: AttendanceServerSavedStaffListDto): Promise<AttendanceServerSavedStaffListResult> {
    const offset = Math.max(0, input.offset);
    const limit = Math.min(Math.max(1, input.limit), 200);
    const search = input.search.trim();
    const query = this.repository.createQueryBuilder("staff");

    if (search) {
      query.andWhere(
        `(
          staff.staff_number LIKE :search OR
          staff.enrollid LIKE :search OR
          staff.name LIKE :search OR
          staff.department_name LIKE :search OR
          staff.email LIKE :search OR
          staff.mobile LIKE :search
        )`,
        { search: `%${search}%` },
      );
    }

    query
      .orderBy("CAST(staff.staff_number AS UNSIGNED)", "ASC")
      .addOrderBy("staff.staff_number", "ASC")
      .addOrderBy("staff.name", "ASC")
      .skip(offset)
      .take(limit);

    const [rows, total] = await query.getManyAndCount();

    return {
      offset,
      limit,
      search,
      total,
      rows: rows.map(toSavedStaffRow),
    };
  }

  async sync(input: AttendanceServerStaffListDto, user?: CurrentUser): Promise<AttendanceServerStaffSyncResult> {
    const limit = Math.min(Math.max(1, input.limit), 200);
    let offset = Math.max(0, input.offset);
    let requested: AttendanceServerStaffSyncResult["requested"] | null = null;
    let total = 0;
    let fetchedRows = 0;
    const now = new Date();
    const savedRows: AttendanceServerStaff[] = [];

    for (let page = 0; page < 100; page += 1) {
      const liveResult = await this.liveStaffService.listStaff({ ...input, offset, limit });
      requested ??= liveResult.requested;
      total = liveResult.total;
      fetchedRows += liveResult.fetchedRows;

      for (let index = 0; index < liveResult.rows.length; index += 1) {
        const normalized = liveResult.rows[index];
        const raw = liveResult.rawRows[index] as RawStaffPayload | undefined;
        savedRows.push(await this.upsertStaff(normalized, raw ?? {}, now, user));
      }

      if (liveResult.fetchedRows === 0 || offset + liveResult.fetchedRows >= liveResult.total) {
        break;
      }

      offset += liveResult.fetchedRows;
    }

    return {
      requested: requested ?? {
        endpoint: input.endpoint,
        sort: input.sort,
        order: input.order,
        offset: input.offset,
        limit,
        search: input.search,
      },
      total,
      fetchedRows,
      savedRows: savedRows.length,
      rows: savedRows.map(toSavedStaffRow),
    };
  }

  private async upsertStaff(
    normalized: AttendanceServerStaffRow,
    raw: RawStaffPayload,
    syncedAt: Date,
    user?: CurrentUser,
  ) {
    const existing = await this.findExistingStaff(normalized);
    const entity = existing ?? this.repository.create();
    this.repository.merge(entity, mapStaffEntity(normalized, raw, syncedAt, user));
    return this.repository.save(entity);
  }

  private async findExistingStaff(staff: AttendanceServerStaffRow) {
    const staffNumber = normalizeNullableString(staff.staffNumber);
    if (staffNumber) {
      const existing = await this.repository.findOne({ where: { staffNumber } });
      if (existing) {
        return existing;
      }
    }

    const yunattId = normalizeNullableString(staff.id);
    if (yunattId) {
      const existing = await this.repository.findOne({ where: { yunattId } });
      if (existing) {
        return existing;
      }
    }

    const enrollid = normalizeNullableString(staff.enrollid);
    if (enrollid) {
      return this.repository.findOne({ where: { enrollid } });
    }

    return null;
  }
}

function mapStaffEntity(
  normalized: AttendanceServerStaffRow,
  raw: RawStaffPayload,
  syncedAt: Date,
  user?: CurrentUser,
): Partial<AttendanceServerStaff> {
  return {
    yunattId: normalizeNullableString(normalized.id),
    enrollid: normalizeNullableString(normalized.enrollid),
    staffNumber: normalizeNullableString(normalized.staffNumber),
    name: normalizeNullableString(normalized.name),
    idNumber: valueToString(raw.idNumber),
    icCard: valueToString(raw.icCard),
    mobile: normalizeNullableString(normalized.mobile),
    punchPwd: valueToString(raw.punchPwd),
    departmentId: valueToString(raw.departmentId),
    departmentName: normalizeNullableString(normalized.departmentName),
    staffTypeId: valueToString(raw.staffTypeId),
    staffType: valueToString(raw.staffType),
    staffDate: valueToString(raw.staffDate),
    staffStatus: normalized.staffStatus,
    sex: valueToNumber(raw.sex),
    stationId: valueToString(raw.stationId),
    station: valueToString(raw.station),
    address: valueToString(raw.address),
    degreeId: valueToString(raw.degreeId),
    degree: valueToString(raw.degree),
    email: normalizeNullableString(normalized.email),
    phone: valueToString(raw.phone),
    remark: valueToString(raw.remark),
    appLogin: valueToBoolean(raw.appLogin),
    punch: normalized.punch,
    senior: valueToBoolean(raw.senior),
    admin: valueToBoolean(raw.admin),
    superAdmin: valueToBoolean(raw.superAdmin),
    leave: valueToBoolean(raw.leave),
    leaveType: valueToString(raw.leaveType),
    leaveDate: valueToString(raw.leaveDate),
    leaveReason: valueToString(raw.leaveReason),
    photo: normalizeNullableString(normalized.photo),
    needApp: valueToString(raw.needApp),
    customerId: valueToString(raw.customerId),
    gmtCreate: valueToString(raw.gmtCreate),
    gmtModified: valueToString(raw.gmtModified),
    fingerNum: valueToNumber(raw.fingerNum),
    faceNum: valueToNumber(raw.faceNum),
    picNum: valueToNumber(raw.picNum),
    attenceMachineIds: valueToString(raw.attenceMachineIds),
    deviceNames: valueToString(raw.deviceNames),
    groupNames: valueToString(raw.groupNames),
    rawPayload: serializeRawPayload(raw),
    lastSyncedAt: syncedAt,
    syncedByUserId: user?.id ?? null,
    syncedByLoginCode: user?.loginCode ?? null,
  };
}

function toSavedStaffRow(staff: AttendanceServerStaff): AttendanceServerSavedStaffRow {
  return {
    id: staff.id,
    yunattId: staff.yunattId ?? "",
    enrollid: staff.enrollid ?? "",
    staffNumber: staff.staffNumber ?? "",
    name: staff.name ?? "",
    idNumber: staff.idNumber ?? "",
    icCard: staff.icCard ?? "",
    mobile: staff.mobile ?? "",
    punchPwd: staff.punchPwd ?? "",
    departmentId: staff.departmentId ?? "",
    departmentName: staff.departmentName ?? "",
    staffTypeId: staff.staffTypeId ?? "",
    staffType: staff.staffType ?? "",
    staffDate: staff.staffDate ?? "",
    staffStatus: staff.staffStatus ?? null,
    sex: staff.sex ?? null,
    stationId: staff.stationId ?? "",
    station: staff.station ?? "",
    address: staff.address ?? "",
    degreeId: staff.degreeId ?? "",
    degree: staff.degree ?? "",
    email: staff.email ?? "",
    phone: staff.phone ?? "",
    remark: staff.remark ?? "",
    appLogin: staff.appLogin,
    punch: staff.punch,
    senior: staff.senior,
    admin: staff.admin,
    superAdmin: staff.superAdmin,
    leave: staff.leave,
    leaveType: staff.leaveType ?? "",
    leaveDate: staff.leaveDate ?? "",
    leaveReason: staff.leaveReason ?? "",
    photo: staff.photo ?? "",
    needApp: staff.needApp ?? "",
    customerId: staff.customerId ?? "",
    gmtCreate: staff.gmtCreate ?? "",
    gmtModified: staff.gmtModified ?? "",
    fingerNum: staff.fingerNum ?? null,
    faceNum: staff.faceNum ?? null,
    picNum: staff.picNum ?? null,
    attenceMachineIds: staff.attenceMachineIds ?? "",
    deviceNames: staff.deviceNames ?? "",
    groupNames: staff.groupNames ?? "",
    rawPayload: parseRawPayload(staff.rawPayload),
    lastSyncedAt: staff.lastSyncedAt ? staff.lastSyncedAt.toISOString() : null,
    syncedByLoginCode: staff.syncedByLoginCode ?? null,
    createdAt: staff.createdAt.toISOString(),
    updatedAt: staff.updatedAt.toISOString(),
  };
}

function valueToString(value: unknown) {
  const normalized = normalizeNullableString(value);
  return normalized ?? null;
}

function normalizeNullableString(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

function valueToNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function valueToBoolean(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function serializeRawPayload(raw: RawStaffPayload) {
  try {
    return JSON.stringify(raw);
  } catch {
    return null;
  }
}

function parseRawPayload(value?: string | null): RawStaffPayload | null {
  if (!value) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as RawStaffPayload)
      : null;
  } catch {
    return null;
  }
}
