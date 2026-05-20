import { AttendanceService } from "./attendance.service";
import { AttendanceServerSettingsService } from "./attendance-server-settings.service";
import { AttendanceServerSyncTestService } from "./attendance-server-sync-test.service";
import type { AttendanceSettingsDto } from "./attendance.dto";

const CHECK_INTERVAL_MS = 60_000;
const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_LIMIT = 200;

type SyncWindow = {
  key: string;
  label: string;
  startMinute: number;
  stopMinute: number;
};

class AttendanceServerAutoSyncService {
  private readonly attendanceService = new AttendanceService();
  private readonly settingsService = new AttendanceServerSettingsService();
  private readonly syncTestService = new AttendanceServerSyncTestService();
  private readonly lastRunKeys = new Set<string>();
  private isRunning = false;

  async tick(now = new Date()) {
    if (this.isRunning) {
      return;
    }

    const setting = await this.settingsService.getStoredSetting();
    const monthDataId = resolveMonthDataId(setting?.autoSyncMonthDataId, setting?.autoSyncMonthMappings, now);
    if (!setting?.autoSyncEnabled || !setting.sessionCookie?.trim() || !monthDataId) {
      return;
    }

    const attendanceSettings = await this.attendanceService.getSettings();
    const activeWindow = findActiveWindow(now, attendanceSettings, {
      startOffsetMinutes: setting.autoSyncStartOffsetMinutes,
      windowMinutes: setting.autoSyncWindowMinutes,
    });
    if (!activeWindow) {
      return;
    }

    const bucketMinute = getBucketMinute(
      now,
      activeWindow,
      Math.max(1, setting.autoSyncIntervalMinutes || 10),
    );
    if (bucketMinute === null) {
      return;
    }

    const runKey = `${formatLocalDate(now)}:${activeWindow.key}:${bucketMinute}`;
    if (this.lastRunKeys.has(runKey)) {
      return;
    }

    this.lastRunKeys.add(runKey);
    this.trimRunKeys();
    this.isRunning = true;
    try {
      await this.runSync(activeWindow.label, monthDataId, setting.attendanceEndpoint, now);
    } finally {
      this.isRunning = false;
    }
  }

  private async runSync(shiftLabel: string, monthDataId: string, attendanceEndpoint: string, now: Date) {
    try {
      const result = await this.syncTestService.test({
        endpoint: attendanceEndpoint,
        cookie: undefined,
        monthDataId,
        order: "asc",
        offset: 0,
        limit: DEFAULT_LIMIT,
        search: "",
      });
      const period = resolveImportPeriod(result.dates, now);

      if (result.rawRows.length === 0 || result.dates.length === 0) {
        await this.settingsService.markAutoSyncRun(
          "success",
          `${shiftLabel}: Máy chấm công chưa trả dữ liệu mới cho monthDataId ${monthDataId}`,
        );
        return;
      }

      const importResult = await this.attendanceService.importServerBody({
        month: period.month,
        year: period.year,
        fileName: `Yunatt auto sync ${shiftLabel} ${monthDataId}`,
        body: {
          total: result.total,
          rows: result.rawRows,
        },
      });
      await this.settingsService.markAutoSyncRun(
        "success",
        `${shiftLabel}: Đã đồng bộ ${result.fetchedRows}/${result.total} dòng, ghi ${importResult.attendanceRows} dòng chấm công`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không đồng bộ được máy chấm công";
      await this.settingsService.markAutoSyncRun("failed", `${shiftLabel}: ${message}`);
    }
  }

  private trimRunKeys() {
    if (this.lastRunKeys.size <= 500) {
      return;
    }

    const keys = Array.from(this.lastRunKeys);
    for (const key of keys.slice(0, keys.length - 300)) {
      this.lastRunKeys.delete(key);
    }
  }
}

let autoSyncStarted = false;

export function startAttendanceServerAutoSync() {
  if (autoSyncStarted) {
    return;
  }

  autoSyncStarted = true;
  const service = new AttendanceServerAutoSyncService();
  const run = () => {
    void service.tick().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown attendance auto-sync error";
      console.error(`Attendance auto-sync scheduler error: ${message}`);
    });
  };
  const timer = setInterval(run, CHECK_INTERVAL_MS);
  timer.unref?.();
  run();
}

function findActiveWindow(
  now: Date,
  settings: AttendanceSettingsDto,
  config: { startOffsetMinutes: number; windowMinutes: number },
) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const windows = buildSyncWindows(settings, config);
  return windows.find((window) => isMinuteInWindow(nowMinutes, window)) ?? null;
}

function buildSyncWindows(
  settings: AttendanceSettingsDto,
  config: { startOffsetMinutes: number; windowMinutes: number },
): SyncWindow[] {
  const startOffsetMinutes = clampInteger(config.startOffsetMinutes, 0, 720, 60);
  const windowMinutes = clampInteger(config.windowMinutes, 1, 720, 60);
  return [
    buildSyncWindow("morning", "Ca sáng", settings.morningStart, startOffsetMinutes, windowMinutes),
    buildSyncWindow("afternoon", "Ca chiều", settings.afternoonStart, startOffsetMinutes, windowMinutes),
    buildSyncWindow("night", "Ca 3", settings.nightStart, startOffsetMinutes, windowMinutes),
  ];
}

function buildSyncWindow(
  key: string,
  label: string,
  shiftStart: string,
  startOffsetMinutes: number,
  windowMinutes: number,
): SyncWindow {
  const startMinute = normalizeDayMinute(timeToMinutes(shiftStart) + startOffsetMinutes);
  const stopMinute = normalizeDayMinute(startMinute + windowMinutes);
  return { key, label, startMinute, stopMinute };
}

function isMinuteInWindow(minute: number, window: SyncWindow) {
  if (window.startMinute < window.stopMinute) {
    return minute >= window.startMinute && minute < window.stopMinute;
  }

  return minute >= window.startMinute || minute < window.stopMinute;
}

function getBucketMinute(now: Date, window: SyncWindow, intervalMinutes: number) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const elapsed = getElapsedWindowMinutes(nowMinutes, window.startMinute);
  if (elapsed < 0) {
    return null;
  }

  return normalizeDayMinute(window.startMinute + Math.floor(elapsed / intervalMinutes) * intervalMinutes);
}

function getElapsedWindowMinutes(nowMinute: number, startMinute: number) {
  return nowMinute >= startMinute ? nowMinute - startMinute : nowMinute + MINUTES_PER_DAY - startMinute;
}

function resolveImportPeriod(dates: string[], now: Date) {
  const firstDate = dates[0];
  const matchedDate = firstDate?.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (matchedDate) {
    return {
      month: Number(matchedDate[2]),
      year: Number(matchedDate[1]),
    };
  }

  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function normalizeDayMinute(value: number) {
  return ((value % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

function clampInteger(value: number, min: number, max: number, fallback: number) {
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function formatLocalDate(value: Date) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function resolveMonthDataId(
  singleMonthDataId: string | null | undefined,
  mappings: Array<{ period: string; monthDataId: string }> | null | undefined,
  now: Date,
) {
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const mapped = mappings?.find((mapping) => mapping.period === currentPeriod)?.monthDataId.trim();
  if (mapped) {
    return mapped;
  }

  return singleMonthDataId?.trim() || "";
}
