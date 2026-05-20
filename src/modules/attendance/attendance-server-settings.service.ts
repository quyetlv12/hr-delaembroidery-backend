import { HttpError } from "../../common/http-error";
import { AppDataSource } from "../../database/data-source";
import { AttendanceServerSetting } from "../../entities";
import type { AttendanceServerSettingsDto } from "./attendance.dto";

export const DEFAULT_YUNATT_ATTENDANCE_ENDPOINT = "https://global.yunatt.com/cardRecord/queryForMonth";
export const DEFAULT_YUNATT_STAFF_ENDPOINT = "https://global.yunatt.com/staff/query";

type CurrentUser = {
  id: string;
  loginCode: string;
};

export type AttendanceServerSettingsResponse = {
  attendanceEndpoint: string;
  staffEndpoint: string;
  hasCookie: boolean;
  cookiePreview: string;
  updatedAt: string | null;
  updatedByLoginCode: string | null;
  autoSyncEnabled: boolean;
  autoSyncMonthDataId: string;
  autoSyncMonthMappings: Array<{ period: string; monthDataId: string }>;
  autoSyncStartOffsetMinutes: number;
  autoSyncWindowMinutes: number;
  autoSyncIntervalMinutes: number;
  autoSyncLastRunAt: string | null;
  autoSyncLastStatus: string | null;
  autoSyncLastMessage: string | null;
};

export class AttendanceServerSettingsService {
  private readonly repository = AppDataSource.getRepository(AttendanceServerSetting);

  async getSettings(): Promise<AttendanceServerSettingsResponse> {
    return this.toResponse(await this.findSetting());
  }

  async updateSettings(dto: AttendanceServerSettingsDto, user?: CurrentUser): Promise<AttendanceServerSettingsResponse> {
    const attendanceEndpoint = this.normalizeEndpoint(dto.attendanceEndpoint, DEFAULT_YUNATT_ATTENDANCE_ENDPOINT);
    const staffEndpoint = this.normalizeEndpoint(dto.staffEndpoint, DEFAULT_YUNATT_STAFF_ENDPOINT);
    const existing = await this.findSetting();
    const sessionCookie = dto.cookie?.trim() || existing?.sessionCookie?.trim() || "";

    if (dto.autoSyncEnabled === true && sessionCookie.length < 10) {
      throw new HttpError(400, "YUNATT_COOKIE_REQUIRED", "Cookie máy chấm công không hợp lệ");
    }

    const setting = existing ?? this.repository.create();
    this.repository.merge(setting, {
      attendanceEndpoint,
      staffEndpoint,
      sessionCookie,
      updatedByUserId: user?.id ?? null,
      updatedByLoginCode: user?.loginCode ?? null,
    });
    if (dto.autoSyncEnabled !== undefined) {
      setting.autoSyncEnabled = dto.autoSyncEnabled;
    }
    if (dto.autoSyncMonthDataId !== undefined) {
      setting.autoSyncMonthDataId = dto.autoSyncMonthDataId.trim();
    }
    if (dto.autoSyncMonthMappings !== undefined) {
      setting.autoSyncMonthMappings = normalizeMonthMappings(dto.autoSyncMonthMappings);
    }
    if (dto.autoSyncStartOffsetMinutes !== undefined) {
      setting.autoSyncStartOffsetMinutes = dto.autoSyncStartOffsetMinutes;
    }
    if (dto.autoSyncWindowMinutes !== undefined) {
      setting.autoSyncWindowMinutes = dto.autoSyncWindowMinutes;
    }
    if (dto.autoSyncIntervalMinutes !== undefined) {
      setting.autoSyncIntervalMinutes = dto.autoSyncIntervalMinutes;
    }

    return this.toResponse(await this.repository.save(setting));
  }

  async resolveConnection(input: {
    cookie?: string | null;
    attendanceEndpoint?: string | null;
    staffEndpoint?: string | null;
  }) {
    const setting = await this.findSetting();
    const cookie = input.cookie?.trim() || setting?.sessionCookie?.trim() || "";
    if (cookie.length < 10) {
      throw new HttpError(
        400,
        "YUNATT_COOKIE_REQUIRED",
        "Chưa cấu hình cookie máy chấm công. Vào màn hình Cấu hình máy chấm công để lưu cookie trước.",
      );
    }

    return {
      cookie,
      attendanceEndpoint: this.normalizeEndpoint(
        input.attendanceEndpoint || setting?.attendanceEndpoint,
        DEFAULT_YUNATT_ATTENDANCE_ENDPOINT,
      ),
      staffEndpoint: this.normalizeEndpoint(input.staffEndpoint || setting?.staffEndpoint, DEFAULT_YUNATT_STAFF_ENDPOINT),
    };
  }

  async getStoredSetting() {
    return this.findSetting();
  }

  async markAutoSyncRun(status: "success" | "failed", message: string) {
    const setting = await this.findSetting();
    if (!setting) {
      return;
    }

    setting.autoSyncLastRunAt = new Date();
    setting.autoSyncLastStatus = status;
    setting.autoSyncLastMessage = message.slice(0, 255);
    await this.repository.save(setting);
  }

  private async findSetting() {
    return this.repository.findOne({
      where: {},
      order: { createdAt: "ASC" },
    });
  }

  private normalizeEndpoint(value: string | null | undefined, fallback: string) {
    const endpoint = value?.trim() || fallback;
    let parsed: URL;
    try {
      parsed = new URL(endpoint);
    } catch {
      throw new HttpError(400, "YUNATT_ENDPOINT_INVALID", "Endpoint máy chấm công không hợp lệ");
    }

    if (parsed.protocol !== "https:" || parsed.hostname !== "global.yunatt.com") {
      throw new HttpError(
        400,
        "YUNATT_ENDPOINT_NOT_ALLOWED",
        "Chỉ cho phép endpoint HTTPS của global.yunatt.com",
      );
    }

    return parsed.toString();
  }

  private toResponse(setting: AttendanceServerSetting | null): AttendanceServerSettingsResponse {
    return {
      attendanceEndpoint: setting?.attendanceEndpoint ?? DEFAULT_YUNATT_ATTENDANCE_ENDPOINT,
      staffEndpoint: setting?.staffEndpoint ?? DEFAULT_YUNATT_STAFF_ENDPOINT,
      hasCookie: Boolean(setting?.sessionCookie?.trim()),
      cookiePreview: maskCookie(setting?.sessionCookie),
      updatedAt: setting?.updatedAt ? setting.updatedAt.toISOString() : null,
      updatedByLoginCode: setting?.updatedByLoginCode ?? null,
      autoSyncEnabled: setting?.autoSyncEnabled ?? false,
      autoSyncMonthDataId: setting?.autoSyncMonthDataId ?? "",
      autoSyncMonthMappings: normalizeMonthMappings(setting?.autoSyncMonthMappings ?? []),
      autoSyncStartOffsetMinutes: setting?.autoSyncStartOffsetMinutes ?? 60,
      autoSyncWindowMinutes: setting?.autoSyncWindowMinutes ?? 60,
      autoSyncIntervalMinutes: setting?.autoSyncIntervalMinutes ?? 10,
      autoSyncLastRunAt: setting?.autoSyncLastRunAt ? setting.autoSyncLastRunAt.toISOString() : null,
      autoSyncLastStatus: setting?.autoSyncLastStatus ?? null,
      autoSyncLastMessage: setting?.autoSyncLastMessage ?? null,
    };
  }
}

function maskCookie(cookie?: string | null) {
  const value = cookie?.trim();
  if (!value) {
    return "";
  }

  const parts = value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts
    .map((part) => {
      const [name, ...rest] = part.split("=");
      const rawValue = rest.join("=");
      if (!rawValue) {
        return `${name}=***`;
      }

      const suffix = rawValue.slice(-4);
      return `${name}=***${suffix}`;
    })
    .join("; ");
}

function normalizeMonthMappings(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const map = new Map<string, string>();
  for (const item of value) {
    if (!isObjectRecord(item)) {
      continue;
    }
    const period = typeof item.period === "string" ? item.period.trim() : "";
    const monthDataId = typeof item.monthDataId === "string" ? item.monthDataId.trim() : "";
    if (!/^\d{4}-\d{2}$/.test(period) || !monthDataId) {
      continue;
    }

    map.set(period, monthDataId);
  }

  return Array.from(map.entries())
    .map(([period, monthDataId]) => ({ period, monthDataId }))
    .sort((left, right) => right.period.localeCompare(left.period));
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
