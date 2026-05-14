import { AppDataSource } from "../../database/data-source";
import { EmployeeViewSetting } from "../../entities";
import {
  attendanceEmployeeViewColumns,
  payrollEmployeeViewColumns,
  type AttendanceEmployeeViewColumn,
  type PayrollEmployeeViewColumn,
} from "./employee-view-settings.constants";
import type { EmployeeViewSettingsDto } from "./employee-view-settings.dto";

export const defaultEmployeeViewSettings: EmployeeViewSettingsDto = {
  payrollColumns: [...payrollEmployeeViewColumns],
  attendanceColumns: [...attendanceEmployeeViewColumns],
};

export class EmployeeViewSettingsService {
  private readonly repository = AppDataSource.getRepository(EmployeeViewSetting);

  async getSettings(): Promise<EmployeeViewSettingsDto> {
    const setting = await this.repository.findOne({
      where: {},
      order: { createdAt: "ASC" },
    });

    if (!setting) {
      return defaultEmployeeViewSettings;
    }

    return {
      payrollColumns: normalizeColumns(setting.payrollColumns, payrollEmployeeViewColumns),
      attendanceColumns: normalizeColumns(setting.attendanceColumns, attendanceEmployeeViewColumns),
    };
  }

  async updateSettings(dto: EmployeeViewSettingsDto) {
    const existing = await this.repository.findOne({
      where: {},
      order: { createdAt: "ASC" },
    });
    const setting = existing ?? this.repository.create();
    this.repository.merge(setting, {
      payrollColumns: normalizeColumns(dto.payrollColumns, payrollEmployeeViewColumns),
      attendanceColumns: normalizeColumns(dto.attendanceColumns, attendanceEmployeeViewColumns),
    });

    const savedSetting = await this.repository.save(setting);
    return {
      payrollColumns: normalizeColumns(savedSetting.payrollColumns, payrollEmployeeViewColumns),
      attendanceColumns: normalizeColumns(savedSetting.attendanceColumns, attendanceEmployeeViewColumns),
    };
  }
}

function normalizeColumns<TColumn extends PayrollEmployeeViewColumn | AttendanceEmployeeViewColumn>(
  value: unknown,
  allowedColumns: readonly TColumn[],
) {
  if (!Array.isArray(value)) {
    return [...allowedColumns];
  }

  const allowedSet = new Set<string>(allowedColumns);
  const columns = value.filter((column): column is TColumn => typeof column === "string" && allowedSet.has(column));
  return columns.length > 0 ? Array.from(new Set(columns)) : [...allowedColumns];
}
