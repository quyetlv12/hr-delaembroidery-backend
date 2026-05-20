import { HttpError } from "../../common/http-error";
import { AttendanceServerSettingsService } from "./attendance-server-settings.service";
import type { AttendanceServerStaffListDto, AttendanceServerSyncTestDto } from "./attendance.dto";

type YunattAttendanceRow = Record<string, unknown> & {
  staffName?: unknown;
  staffNumber?: unknown;
};

type YunattAttendanceResponse = {
  total?: unknown;
  rows?: unknown;
};

type YunattStaffRow = Record<string, unknown> & {
  id?: unknown;
  enrollid?: unknown;
  staffNumber?: unknown;
  name?: unknown;
  departmentName?: unknown;
  email?: unknown;
  mobile?: unknown;
  staffStatus?: unknown;
  punch?: unknown;
  photo?: unknown;
};

export type AttendanceServerSyncTestRow = {
  staffNumber: string;
  staffName: string;
  days: Record<string, string[]>;
  presentDays: number;
  punchCount: number;
};

export type AttendanceServerSyncTestResult = {
  requested: {
    endpoint: string;
    monthDataId: string;
    order: "asc" | "desc";
    offset: number;
    limit: number;
    search: string;
  };
  total: number;
  fetchedRows: number;
  dates: string[];
  rows: AttendanceServerSyncTestRow[];
  rawRows: YunattAttendanceRow[];
};

export type AttendanceServerStaffRow = {
  id: string;
  enrollid: string;
  staffNumber: string;
  name: string;
  departmentName: string;
  email: string;
  mobile: string;
  staffStatus: number | null;
  punch: boolean;
  photo: string;
};

export type AttendanceServerStaffListResult = {
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
  rows: AttendanceServerStaffRow[];
  rawRows: YunattStaffRow[];
};

export class AttendanceServerSyncTestService {
  private readonly settingsService = new AttendanceServerSettingsService();

  async test(input: AttendanceServerSyncTestDto): Promise<AttendanceServerSyncTestResult> {
    const connection = await this.settingsService.resolveConnection({
      cookie: input.cookie,
      attendanceEndpoint: input.endpoint,
    });
    const endpoint = this.parseEndpoint(connection.attendanceEndpoint);
    const body = new URLSearchParams({
      order: input.order,
      offset: String(input.offset),
      limit: String(input.limit),
      monthDataId: input.monthDataId,
      search: input.search,
    });

    const responseText = await this.fetchYunatt(endpoint, connection.cookie, body, "/cardRecord/monthIndex");
    const parsed = this.parseYunattResponse(responseText);
    const rawRows = parsed.rows;
    const dates = new Set<string>();
    const rows = rawRows.map((row) => this.normalizeRow(row, dates));

    return {
      requested: {
        endpoint: endpoint.toString(),
        monthDataId: input.monthDataId,
        order: input.order,
        offset: input.offset,
        limit: input.limit,
        search: input.search,
      },
      total: parsed.total ?? rows.length,
      fetchedRows: rows.length,
      dates: Array.from(dates).sort(),
      rows,
      rawRows,
    };
  }

  async listStaff(input: AttendanceServerStaffListDto): Promise<AttendanceServerStaffListResult> {
    const connection = await this.settingsService.resolveConnection({
      cookie: input.cookie,
      staffEndpoint: input.endpoint,
    });
    const endpoint = this.parseEndpoint(connection.staffEndpoint);
    const body = new URLSearchParams({
      sort: input.sort,
      order: input.order,
      offset: String(input.offset),
      limit: String(input.limit),
      search: input.search,
    });

    const responseText = await this.fetchYunatt(endpoint, connection.cookie, body, "/staff/index");
    const parsed = this.parseYunattResponse(responseText);
    const rawRows = parsed.rows as YunattStaffRow[];

    return {
      requested: {
        endpoint: endpoint.toString(),
        sort: input.sort,
        order: input.order,
        offset: input.offset,
        limit: input.limit,
        search: input.search,
      },
      total: parsed.total ?? rawRows.length,
      fetchedRows: rawRows.length,
      rows: rawRows.map(normalizeStaffRow),
      rawRows,
    };
  }

  private parseEndpoint(endpoint: string) {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== "https:" || parsed.hostname !== "global.yunatt.com") {
      throw new HttpError(
        400,
        "YUNATT_ENDPOINT_NOT_ALLOWED",
        "Chỉ cho phép test endpoint HTTPS của global.yunatt.com",
      );
    }

    return parsed;
  }

  private async fetchYunatt(endpoint: URL, cookie: string, body: URLSearchParams, refererPath: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Accept-Language": "en-US,en;q=0.6",
          "Cache-Control": "no-cache",
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: cookie,
          Origin: "https://global.yunatt.com",
          Pragma: "no-cache",
          Referer: `https://global.yunatt.com${refererPath}`,
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: body.toString(),
      });
      const text = await response.text();

      if (!response.ok) {
        throw new HttpError(502, "YUNATT_REQUEST_FAILED", "Máy chấm công trả về lỗi", {
          status: response.status,
          body: text.slice(0, 500),
        });
      }

      return text;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new HttpError(504, "YUNATT_REQUEST_TIMEOUT", "Kết nối máy chấm công quá thời gian");
      }

      throw new HttpError(502, "YUNATT_REQUEST_FAILED", "Không gọi được API máy chấm công");
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseYunattResponse(responseText: string) {
    let parsed: YunattAttendanceResponse;
    try {
      parsed = JSON.parse(responseText) as YunattAttendanceResponse;
    } catch {
      throw new HttpError(502, "YUNATT_RESPONSE_INVALID", "Máy chấm công không trả về JSON hợp lệ", {
        body: responseText.slice(0, 500),
      });
    }

    if (!Array.isArray(parsed.rows)) {
      throw new HttpError(502, "YUNATT_RESPONSE_INVALID", "Response máy chấm công thiếu danh sách rows");
    }

    const total = typeof parsed.total === "number" ? parsed.total : Number(parsed.total);

    return {
      total: Number.isFinite(total) ? total : undefined,
      rows: parsed.rows.filter(isObjectRecord) as YunattAttendanceRow[],
    };
  }

  private normalizeRow(row: YunattAttendanceRow, dates: Set<string>): AttendanceServerSyncTestRow {
    const dayValues: Record<string, string[]> = {};
    let punchCount = 0;

    for (const [key, value] of Object.entries(row)) {
      const date = key.match(/^day-(\d{4}-\d{2}-\d{2})$/)?.[1];
      if (!date) {
        continue;
      }

      const times = normalizePunchValue(value);
      if (times.length === 0) {
        continue;
      }

      dates.add(date);
      dayValues[date] = times;
      punchCount += times.length;
    }

    return {
      staffNumber: valueToString(row.staffNumber),
      staffName: valueToString(row.staffName),
      days: dayValues,
      presentDays: Object.keys(dayValues).length,
      punchCount,
    };
  }
}

function normalizePunchValue(value: unknown) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/<br\s*\/?>/i)
    .map((part) => part.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim())
    .filter(Boolean);
}

function valueToString(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function valueToNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeStaffRow(row: YunattStaffRow): AttendanceServerStaffRow {
  return {
    id: valueToString(row.id),
    enrollid: valueToString(row.enrollid),
    staffNumber: valueToString(row.staffNumber),
    name: valueToString(row.name),
    departmentName: valueToString(row.departmentName),
    email: valueToString(row.email),
    mobile: valueToString(row.mobile),
    staffStatus: valueToNumber(row.staffStatus),
    punch: row.punch === true,
    photo: valueToString(row.photo),
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
