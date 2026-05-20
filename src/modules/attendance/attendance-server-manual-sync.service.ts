import { AttendanceService } from "./attendance.service";
import {
  DEFAULT_YUNATT_ATTENDANCE_ENDPOINT,
  AttendanceServerSettingsService,
} from "./attendance-server-settings.service";
import { AttendanceServerSyncTestService } from "./attendance-server-sync-test.service";
import type { AttendanceServerManualSyncDto } from "./attendance.dto";

const PAGE_LIMIT = 200;
const MAX_PAGES = 100;

type YunattRawRow = Record<string, unknown>;

export class AttendanceServerManualSyncService {
  private readonly attendanceService = new AttendanceService();
  private readonly settingsService = new AttendanceServerSettingsService();
  private readonly syncTestService = new AttendanceServerSyncTestService();

  async sync(input: AttendanceServerManualSyncDto) {
    const monthDataId = input.monthDataId.trim();
    const setting = await this.settingsService.getStoredSetting();
    const endpoint = setting?.attendanceEndpoint || DEFAULT_YUNATT_ATTENDANCE_ENDPOINT;
    const rawRows: YunattRawRow[] = [];
    let total = 0;
    let fetchedRows = 0;

    for (let page = 0, offset = 0; page < MAX_PAGES; page += 1) {
      const liveResult = await this.syncTestService.test({
        endpoint,
        cookie: undefined,
        monthDataId,
        order: "asc",
        offset,
        limit: PAGE_LIMIT,
        search: "",
      });

      total = liveResult.total;
      fetchedRows += liveResult.fetchedRows;
      rawRows.push(...liveResult.rawRows);

      if (liveResult.fetchedRows === 0 || offset + liveResult.fetchedRows >= liveResult.total) {
        break;
      }

      offset += liveResult.fetchedRows;
    }

    const targetRows = remapRowsToTargetPeriod(rawRows, input.month, input.year);
    const importResult = await this.attendanceService.importServerBody({
      month: input.month,
      year: input.year,
      fileName: `Yunatt manual sync ${input.sourcePeriod ?? monthDataId} -> ${input.year}-${String(input.month).padStart(2, "0")}`,
      body: {
        total,
        rows: targetRows,
      },
    });

    return {
      requested: {
        monthDataId,
        sourcePeriod: input.sourcePeriod ?? null,
        month: input.month,
        year: input.year,
      },
      total,
      fetchedRows,
      importedEmployees: importResult.importedEmployees,
      attendanceRows: importResult.attendanceRows,
      attendanceLogs: importResult.attendanceLogs,
      unmatchedRows: importResult.unmatchedRows,
      payroll: importResult.payroll,
    };
  }
}

function remapRowsToTargetPeriod(rows: YunattRawRow[], month: number, year: number) {
  const targetMonth = String(month).padStart(2, "0");
  const maxDay = new Date(year, month, 0).getDate();

  return rows.map((row) => {
    const nextRow: YunattRawRow = {};
    for (const [key, value] of Object.entries(row)) {
      const matchedDate = key.match(/^day-\d{4}-\d{2}-(\d{2})$/);
      if (!matchedDate) {
        nextRow[key] = value;
        continue;
      }

      const day = Number(matchedDate[1]);
      if (!Number.isInteger(day) || day < 1 || day > maxDay) {
        continue;
      }

      nextRow[`day-${year}-${targetMonth}-${String(day).padStart(2, "0")}`] = value;
    }

    return nextRow;
  });
}
