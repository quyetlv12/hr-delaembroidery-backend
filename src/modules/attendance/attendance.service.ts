import * as XLSX from "xlsx";
import { Between, In } from "typeorm";

import { HttpError } from "../../common/http-error";
import {
  getDaysInVietnamMonth,
  getVietnamDateParts,
  getVietnamDayOfWeek,
  isValidVietnamDateOnly,
  VIETNAM_TIMEZONE_OFFSET_MS,
} from "../../common/vietnam-time";
import { AppDataSource } from "../../database/data-source";
import {
  AttendanceLog,
  AttendanceMonthSetting,
  AttendanceSetting,
  AttendanceSummary,
  Employee,
  Holiday,
} from "../../entities";
import {
  attendanceEmployeeViewColumns,
  type AttendanceEmployeeViewColumn,
} from "../employee-view-settings/employee-view-settings.constants";
import { EmployeeViewSettingsService } from "../employee-view-settings/employee-view-settings.service";
import { getMonthRange, PayrollService } from "../payroll/payroll.service";
import type {
  AttendanceHolidaySettingsDto,
  AttendanceMonthSettingDto,
  AttendanceServerBodyImportDto,
  AttendanceSettingsDto,
  UpdateAttendanceSummariesDto,
  UpdateAttendanceSummaryRowDto,
} from "./attendance.dto";
import { buildAttendancePayPreviewRecord } from "./attendance-pay-preview";

type ParsedDateColumn = {
  index: number;
  month: number;
  day: number;
  label: string;
};

type AttendanceHeader = {
  rowIndex: number;
  codeIndex: number;
  nameIndex: number;
  dateColumns: ParsedDateColumn[];
};

type ImportOptions = {
  file: Express.Multer.File;
  month?: number;
  year?: number;
  autoCreateMissingEmployees?: boolean;
};

type ShiftSessions = {
  morningIn: number | null;
  morningOut: number | null;
  afternoonIn: number | null;
  afternoonOut: number | null;
  nightIn: number | null;
  nightOut: number | null;
  workDay: number;
  isMissingPunch: boolean;
};

type ShiftSchedule = {
  morningStart: number;
  morningEnd: number;
  lunchSplit: number;
  dinnerSplit: number;
  afternoonStart: number;
  afternoonEnd: number;
  nightStart: number;
  nightEnd: number;
  noLunchPunchMorningLimit: number;
  noLunchPunchAfternoonLimit: number;
};

type ParsedAttendanceCell = {
  hasData: boolean;
  times: string[];
  shifts: {
    morningIn?: string;
    morningOut?: string;
    afternoonIn?: string;
    afternoonOut?: string;
    nightIn?: string;
    nightOut?: string;
  };
  checkInAt: Date | null;
  checkOutAt: Date | null;
  morningCheckInAt: Date | null;
  morningCheckOutAt: Date | null;
  afternoonCheckInAt: Date | null;
  afternoonCheckOutAt: Date | null;
  nightCheckInAt: Date | null;
  nightCheckOutAt: Date | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  workDay: number;
  status: string;
};

export type AttendancePreviewDay = {
  date: string;
  column: string;
  value: string;
  times: string[];
  workDay: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  status: string;
};

export type AttendancePreviewRow = {
  employeeCode: string;
  employeeName: string;
  matchedEmployeeId?: string;
  matchedEmployeeCode?: string;
  matchedEmployeeName?: string;
  days: AttendancePreviewDay[];
};

export type AttendancePayrollPreviewRecord = {
  employeeId?: string;
  employeeCode: string;
  employeeName: string;
  departmentName?: string;
  positionName?: string;
  email?: string;
  configuredSalary: number;
  insuranceSalary: number;
  workDay: number;
  standardWorkDay: number;
  fixedDailySalary: number;
  responsibilityAllowance: number;
  mealAllowance: number;
  phoneAllowance: number;
  kpiAllowance: number;
  dailyTotal: number;
  overtimeWorkDay: number;
  totalWorkDay: number;
  baseSalary: number;
  earnedSalary: number;
  allowanceTotal: number;
  bonusTotal: number;
  overtimeTotal: number;
  grossSalary: number;
  employerInsuranceTotal: number;
  insuranceTotal: number;
  totalInsurance: number;
  taxTotal: number;
  advanceTotal: number;
  deductionTotal: number;
  netSalary: number;
};

export type AttendancePayrollPreview = {
  records: AttendancePayrollPreviewRecord[];
  totals: {
    employeeCount: number;
    workDay: number;
    netSalary: number;
  };
};

export type ConfirmAttendanceImportInput = {
  month: number;
  year: number;
  fileName?: string;
  autoCreateMissingEmployees?: boolean;
  rows: AttendancePreviewRow[];
};

type PayrollMonthSetting = {
  month: number;
  year: number;
  standardWorkDay: number;
  holidayPaidDays: number;
  holidayBonusAmount: number;
  holidayBonusTotal: number;
};

type YunattAdminBodyRow = Record<string, unknown> & {
  staffName?: unknown;
  staffNumber?: unknown;
};

type EmployeeLookupMap = {
  byCode: Map<string, Employee>;
  byTimekeepingCode: Map<string, Employee>;
  byName: Map<string, Employee>;
};

type WorkCalendar = {
  weeklyDaysOff: Set<number>;
  holidayDates: Set<string>;
};

type ParseAttendanceOptions = {
  isNonWorkingDay?: boolean;
};

const DEFAULT_WEEKLY_DAYS_OFF = [0];

const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettingsDto = {
  morningStart: "07:30",
  morningEnd: "11:30",
  afternoonStart: "13:30",
  afternoonEnd: "17:30",
  nightStart: "18:00",
  nightEnd: "21:00",
  overtimeRate: 1.5,
  holidayRate: 2,
  weeklyDaysOff: DEFAULT_WEEKLY_DAYS_OFF,
};

export class AttendanceService {
  private readonly employeeRepository = AppDataSource.getRepository(Employee);
  private readonly holidayRepository = AppDataSource.getRepository(Holiday);
  private readonly logRepository = AppDataSource.getRepository(AttendanceLog);
  private readonly monthSettingRepository = AppDataSource.getRepository(AttendanceMonthSetting);
  private readonly settingRepository = AppDataSource.getRepository(AttendanceSetting);
  private readonly summaryRepository = AppDataSource.getRepository(AttendanceSummary);
  private readonly payrollService = new PayrollService();
  private readonly employeeViewSettingsService = new EmployeeViewSettingsService();

  async getSettings() {
    const settings = await this.findSettings();
    return settings ? this.toSettingsDto(settings) : DEFAULT_ATTENDANCE_SETTINGS;
  }

  async updateSettings(dto: AttendanceSettingsDto) {
    validateAttendanceSettings(dto);
    const existing = await this.findSettings();
    const settings = existing ?? this.settingRepository.create();
    this.settingRepository.merge(settings, {
      morningStart: dto.morningStart,
      morningEnd: dto.morningEnd,
      afternoonStart: dto.afternoonStart,
      afternoonEnd: dto.afternoonEnd,
      nightStart: dto.nightStart,
      nightEnd: dto.nightEnd,
      overtimeRate: String(dto.overtimeRate),
      holidayRate: String(dto.holidayRate),
      weeklyDaysOff: formatWeeklyDaysOff(dto.weeklyDaysOff),
    });

    const savedSettings = await this.settingRepository.save(settings);
    await this.recalculateExistingAttendancePeriods();
    return this.toSettingsDto(savedSettings);
  }

  async listMonthSettings(year: number) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new HttpError(400, "INVALID_ATTENDANCE_SETTINGS_YEAR", "Năm cấu hình không hợp lệ");
    }

    const settings = await this.monthSettingRepository.find({
      where: { year },
      order: { month: "ASC" },
    });
    const settingByMonth = new Map(settings.map((setting) => [setting.month, setting]));

    const weeklyDaysOff = await this.getWeeklyDaysOff();
    return {
      year,
      rows: Array.from({ length: 12 }, (_, index) =>
        this.toMonthSettingDto(settingByMonth.get(index + 1), index + 1, year, weeklyDaysOff),
      ),
    };
  }

  async updateMonthSetting(dto: AttendanceMonthSettingDto) {
    const existing = await this.monthSettingRepository.findOne({
      where: {
        month: dto.month,
        year: dto.year,
      },
    });
    const settings = existing ?? this.monthSettingRepository.create({ month: dto.month, year: dto.year });
    this.monthSettingRepository.merge(settings, {
      standardWorkDay: String(dto.standardWorkDay),
      holidayPaidDays: String(dto.holidayPaidDays),
      holidayBonusAmount: String(dto.holidayBonusAmount),
    });

    const savedSettings = await this.monthSettingRepository.save(settings);
    await this.payrollService.recalculatePeriodIfUnlocked(dto.month, dto.year);
    return this.toMonthSettingDto(savedSettings, dto.month, dto.year);
  }

  async listHolidaySettings(year: number) {
    validateSettingsYear(year);
    const { from, to } = getYearRange(year);
    const holidays = await this.holidayRepository.find({
      where: { holidayDate: Between(from, to) },
      order: { holidayDate: "ASC" },
    });

    return {
      year,
      holidays: holidays.map(toHolidayDto),
    };
  }

  async updateHolidaySettings(dto: AttendanceHolidaySettingsDto) {
    validateSettingsYear(dto.year);
    const holidays = normalizeHolidaySettings(dto.year, dto);
    const { from, to } = getYearRange(dto.year);

    await AppDataSource.transaction(async (manager) => {
      const holidayRepository = manager.getRepository(Holiday);
      await holidayRepository
        .createQueryBuilder()
        .delete()
        .where("holiday_date BETWEEN :from AND :to", { from, to })
        .execute();

      if (holidays.length === 0) {
        return;
      }

      await holidayRepository.save(
        holidays.map((holiday) =>
          holidayRepository.create({
            holidayDate: holiday.date,
            name: holiday.name || `Ngày lễ ${formatDisplayDate(holiday.date)}`,
            isPaid: holiday.isPaid,
            bonusAmount: String(holiday.amount),
          }),
        ),
      );
    });

    await this.recalculateAttendancePeriods(
      Array.from({ length: 12 }, (_, index) => `${dto.year}-${String(index + 1).padStart(2, "0")}`),
    );

    return this.listHolidaySettings(dto.year);
  }

  async list(month: number, year: number, employeeId?: string) {
    const schedule = await this.getShiftSchedule();
    const workCalendar = await this.getWorkCalendar(month, year);
    const dateRange = getMonthRange(month, year);
    const where = employeeId
      ? { workDate: Between(dateRange.from, dateRange.to), employee: { id: employeeId } }
      : { workDate: Between(dateRange.from, dateRange.to) };
    const summaries = await this.summaryRepository.find({
      where,
      relations: { employee: true },
      order: {
        workDate: "ASC",
        employee: {
          employeeCode: "ASC",
        },
      },
    });
    const logs = await this.logRepository.find({
      where,
      relations: { employee: true },
    });
    const logsBySummaryKey = groupUniqueLogsByAttendanceKey(logs);

    const rows = summaries.map((summary) => {
      const log = logsBySummaryKey.get(getAttendanceKey(summary.employee.id, summary.workDate));
      const parsedFallback = this.parseLogShiftTimes(summary, log, schedule, workCalendar);
      return this.toSummaryDto(summary, parsedFallback);
    });
    const visibleColumns = employeeId
      ? (await this.employeeViewSettingsService.getSettings()).attendanceColumns
      : [...attendanceEmployeeViewColumns];
    const totals = {
      rows: summaries.length,
      workDay: roundNumber(sum(rows.map((row) => Number(row.workDay)))),
      lateMinutes: sum(rows.map((row) => row.lateMinutes)),
      earlyLeaveMinutes: sum(rows.map((row) => row.earlyLeaveMinutes)),
      overtimeMinutes: sum(rows.map((row) => row.overtimeMinutes)),
    };

    return {
      month,
      year,
      rows: employeeId ? rows.map((row) => filterAttendanceRow(row, visibleColumns)) : rows,
      totals: employeeId ? filterAttendanceTotals(totals, visibleColumns) : totals,
      visibleColumns,
    };
  }

  async previewFile(options: Pick<ImportOptions, "file" | "month" | "year">) {
    const rows = parseWorkbookRows(options.file);
    const schedule = await this.getShiftSchedule();
    const preview = await this.buildPreview(
      rows,
      normalizeImportYear(options.year),
      normalizeImportMonth(options.month),
      schedule,
    );

    return {
      fileName: options.file.originalname,
      ...preview,
    };
  }

  async confirmImport(input: ConfirmAttendanceImportInput) {
    const month = normalizeImportMonth(input.month);
    if (month === undefined) {
      throw new HttpError(400, "INVALID_ATTENDANCE_PERIOD", "Vui lòng chọn tháng chấm công");
    }

    return this.commitPreviewRows({
      ...input,
      month,
      year: normalizeImportYear(input.year),
    });
  }

  async importServerBody(input: AttendanceServerBodyImportDto) {
    const month = normalizeImportMonth(input.month);
    if (month === undefined) {
      throw new HttpError(400, "INVALID_ATTENDANCE_PERIOD", "Vui lòng chọn tháng chấm công");
    }
    const year = normalizeImportYear(input.year);
    const schedule = await this.getShiftSchedule();
    const workCalendar = await this.getWorkCalendar(month, year);
    const rows = parseYunattAdminBodyRows(input.body);
    const employees = await this.employeeRepository.find({ relations: { department: true, position: true } });
    const employeeMap = createEmployeeMap(employees);
    const previewRows: AttendancePreviewRow[] = [];

    for (const rawRow of rows) {
      const staffNumber = stringCell(rawRow.staffNumber);
      const staffName = stringCell(rawRow.staffName);
      const matchedEmployee = findEmployeeByAttendanceCode(employeeMap, staffNumber);
      const shiftCount = matchedEmployee?.shiftCount ?? 2;
      const days = buildPreviewDaysFromYunattRow(rawRow, year, month, shiftCount, schedule, workCalendar);

      if (days.length === 0) {
        continue;
      }

      previewRows.push({
        employeeCode: staffNumber,
        employeeName: staffName,
        matchedEmployeeId: matchedEmployee?.id,
        matchedEmployeeCode: matchedEmployee?.employeeCode,
        matchedEmployeeName: matchedEmployee?.fullName,
        days,
      });
    }

    if (previewRows.length === 0) {
      throw new HttpError(422, "NO_ATTENDANCE_IMPORTED", "Body admin không có dữ liệu chấm công trong kỳ đã chọn");
    }

    return this.commitPreviewRows({
      month,
      year,
      fileName: input.fileName || `yunatt-admin-body-${year}-${String(month).padStart(2, "0")}.json`,
      autoCreateMissingEmployees: false,
      rows: previewRows,
    });
  }

  async updateSummaries(input: UpdateAttendanceSummariesDto) {
    const rowsWithId = input.rows.filter((row): row is UpdateAttendanceSummaryRowDto & { id: string } =>
      Boolean(row.id),
    );
    const rowsWithoutId = input.rows.filter((row) => !row.id);
    const ids = rowsWithId.map((row) => row.id);
    const existingSummaries =
      ids.length > 0
        ? await this.summaryRepository.find({
            where: { id: In(ids) },
            relations: { employee: true },
          })
        : [];

    if (existingSummaries.length !== ids.length) {
      throw new HttpError(404, "ATTENDANCE_SUMMARY_NOT_FOUND", "Không tìm thấy dòng chấm công");
    }

    const employeeIds = Array.from(
      new Set(rowsWithoutId.map((row) => row.employeeId).filter((employeeId): employeeId is string => Boolean(employeeId))),
    );
    const employees =
      employeeIds.length > 0 ? await this.employeeRepository.find({ where: { id: In(employeeIds) } }) : [];
    const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
    const newSummaries = rowsWithoutId.map((row) => {
      const employee = row.employeeId ? employeeMap.get(row.employeeId) : undefined;
      if (!employee || !row.workDate) {
        throw new HttpError(404, "EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên để tạo dòng chấm công");
      }

      return this.summaryRepository.create({
        employee,
        workDate: row.workDate,
        checkInAt: null,
        checkOutAt: null,
        morningCheckInAt: null,
        morningCheckOutAt: null,
        afternoonCheckInAt: null,
        afternoonCheckOutAt: null,
        nightCheckInAt: null,
        nightCheckOutAt: null,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        workDay: "0",
        status: "missing_punch",
      });
    });
    const summaries = [...existingSummaries, ...newSummaries];
    const periods = new Set(summaries.map((summary) => getPeriodKey(summary.workDate)));
    if (periods.size !== 1) {
      throw new HttpError(400, "INVALID_ATTENDANCE_PERIOD", "Chỉ được cập nhật dữ liệu trong cùng một kỳ công");
    }

    const [periodKey] = Array.from(periods);
    const [year, month] = periodKey.split("-").map(Number);
    if (!Number.isFinite(month) || !Number.isFinite(year)) {
      throw new HttpError(400, "INVALID_ATTENDANCE_PERIOD", "Kỳ công không hợp lệ");
    }

    const payroll = await this.payrollService.list({ month, year });
    if (payroll.period?.status === "locked") {
      throw new HttpError(400, "PAYROLL_LOCKED", "Kỳ lương đã khóa, không thể sửa chấm công");
    }

    const rowInputMap = new Map(rowsWithId.map((row) => [row.id, row]));
    const rowInputByEmployeeDate = new Map(
      rowsWithoutId.map((row) => [`${row.employeeId}:${row.workDate}`, row] as const),
    );
    const schedule = await this.getShiftSchedule();
    const workCalendar = await this.getWorkCalendar(month, year);
    const updatedSummaries = summaries.map((summary) => {
      const rowInput =
        rowInputMap.get(summary.id) ?? rowInputByEmployeeDate.get(`${summary.employee.id}:${summary.workDate}`);
      if (!rowInput) {
        return summary;
      }

      this.mergeManualAttendance(summary, rowInput, schedule, workCalendar);
      return summary;
    });

    const savedSummaries = await this.summaryRepository.save(updatedSummaries);
    await Promise.all(
      savedSummaries.map((summary) =>
        this.upsertManualAttendanceLog(
          summary,
          rowInputMap.get(summary.id) ?? rowInputByEmployeeDate.get(`${summary.employee.id}:${summary.workDate}`),
          schedule,
          workCalendar,
        ),
      ),
    );
    await this.payrollService.calculatePeriod({ month, year });

    return {
      rows: savedSummaries.map((summary) => this.toSummaryDto(summary)),
    };
  }

  async importFile(options: ImportOptions) {
    const rows = parseWorkbookRows(options.file);
    if (rows.length < 2) {
      throw new HttpError(422, "INVALID_ATTENDANCE_FILE", "File chấm công không có dòng dữ liệu");
    }

    const importMonthInput = normalizeImportMonth(options.month);
    const importYear = normalizeImportYear(options.year);
    const attendanceHeader = findAttendanceHeader(rows, importMonthInput);
    const { codeIndex, nameIndex, dateColumns } = attendanceHeader;

    const importedMonths = Array.from(new Set(dateColumns.map((column) => column.month)));
    if (importedMonths.length !== 1) {
      throw new HttpError(422, "INVALID_ATTENDANCE_FILE", "Mỗi lần nhập chấm công chỉ được chứa một tháng");
    }
    const importMonth = importedMonths[0] ?? getVietnamDateParts().month;
    const employees = await this.employeeRepository.find({ relations: { department: true, position: true } });
    const employeeMap = createEmployeeMap(employees);
    const schedule = await this.getShiftSchedule();
    const workCalendar = await this.getWorkCalendar(importMonth, importYear);
    const summaryRows: AttendanceSummary[] = [];
    const logRows: AttendanceLog[] = [];
    const unmatchedRows: Array<{ code: string; name: string }> = [];
    let createdEmployees = 0;

    for (const row of rows.slice(attendanceHeader.rowIndex + 1)) {
      const rawCode = stringCell(row[codeIndex]);
      const rawName = stringCell(row[nameIndex]);
      if (!rawCode && !rawName) {
        continue;
      }

      const attendanceCells = dateColumns
        .map((column) => ({
          column,
          value: stringCell(row[column.index]),
        }))
        .filter((item) => hasAttendanceValue(item.value));

      if (attendanceCells.length === 0) {
        continue;
      }

      let employee = findEmployeeByAttendanceCode(employeeMap, rawCode);
      if (!employee && options.autoCreateMissingEmployees !== false && rawCode && rawName) {
        employee = await this.createImportedEmployee(rawCode, rawName, importYear, importMonth);
        employees.push(employee);
        addEmployeeToMap(employeeMap, employee);
        createdEmployees += 1;
      }

      if (!employee) {
        unmatchedRows.push({ code: rawCode, name: rawName });
        continue;
      }

      for (const { column, value } of attendanceCells) {
        const parsedCell = parseAttendanceCell(
          value,
          importYear,
          column.month,
          column.day,
          employee.shiftCount,
          schedule,
          { isNonWorkingDay: isNonWorkingDate(formatDate(importYear, column.month, column.day), workCalendar) },
        );
        if (!parsedCell.hasData) {
          continue;
        }

        summaryRows.push(
          this.summaryRepository.create({
            employee,
            workDate: formatDate(importYear, column.month, column.day),
            checkInAt: parsedCell.checkInAt,
            checkOutAt: parsedCell.checkOutAt,
            morningCheckInAt: parsedCell.morningCheckInAt,
            morningCheckOutAt: parsedCell.morningCheckOutAt,
            afternoonCheckInAt: parsedCell.afternoonCheckInAt,
            afternoonCheckOutAt: parsedCell.afternoonCheckOutAt,
            nightCheckInAt: parsedCell.nightCheckInAt,
            nightCheckOutAt: parsedCell.nightCheckOutAt,
            lateMinutes: parsedCell.lateMinutes,
            earlyLeaveMinutes: parsedCell.earlyLeaveMinutes,
            overtimeMinutes: parsedCell.overtimeMinutes,
            workDay: String(parsedCell.workDay),
            status: parsedCell.status,
          }),
        );
        logRows.push(
          this.logRepository.create({
            employee,
            source: "file",
            workDate: formatDate(importYear, column.month, column.day),
            checkInAt: parsedCell.checkInAt,
            checkOutAt: parsedCell.checkOutAt,
            rawPayload: {
              employeeCode: rawCode,
              employeeName: rawName,
              date: formatDate(importYear, column.month, column.day),
              value,
              times: parsedCell.times,
              shifts: parsedCell.shifts,
              column: column.label,
              fileName: options.file.originalname,
            },
          }),
        );
      }
    }

    if (summaryRows.length === 0) {
      throw new HttpError(422, "NO_ATTENDANCE_IMPORTED", "Không có dòng chấm công nào khớp nhân viên");
    }

    const employeeIds = Array.from(new Set(summaryRows.map((summary) => summary.employee.id)));
    const dateRange = getMonthRange(importMonth, importYear);
    await Promise.all([
      this.summaryRepository
        .createQueryBuilder()
        .delete()
        .from(AttendanceSummary)
        .where("employeeId IN (:...employeeIds)", { employeeIds })
        .andWhere("work_date BETWEEN :from AND :to", dateRange)
        .execute(),
      this.logRepository
        .createQueryBuilder()
        .delete()
        .from(AttendanceLog)
        .where("employeeId IN (:...employeeIds)", { employeeIds })
        .andWhere("work_date BETWEEN :from AND :to", dateRange)
        .execute(),
    ]);

    await this.summaryRepository.save(summaryRows);
    await this.logRepository.save(logRows);
    const payroll = await this.payrollService.calculatePeriod({ month: importMonth, year: importYear });

    return {
      fileName: options.file.originalname,
      month: importMonth,
      year: importYear,
      importedEmployees: employeeIds.length,
      createdEmployees,
      attendanceRows: summaryRows.length,
      attendanceLogs: logRows.length,
      unmatchedRows,
      payroll,
    };
  }

  private async createImportedEmployee(code: string, name: string, year: number, month: number) {
    const normalizedCode = code.trim();
    return this.employeeRepository.save(
      this.employeeRepository.create({
        employeeCode: normalizedCode,
        fullName: name.trim(),
        timekeepingCode: normalizedCode,
        gender: "other",
        email: `${normalizeKey(normalizedCode || name)}@attendance.local`,
        joinDate: formatDate(year, month, 1),
        shiftCount: 2,
        baseSalary: "0",
        status: "active",
      }),
    );
  }

  private async findSettings() {
    return this.settingRepository.findOne({
      where: {},
      order: { createdAt: "ASC" },
    });
  }

  private async getShiftSchedule() {
    const settings = await this.getSettings();
    return toShiftSchedule(settings);
  }

  private async getWeeklyDaysOff() {
    const settings = await this.findSettings();
    return normalizeWeeklyDaysOff(settings?.weeklyDaysOff);
  }

  private async getWorkCalendar(month: number, year: number): Promise<WorkCalendar> {
    const weeklyDaysOff = await this.getWeeklyDaysOff();
    const { from, to } = getMonthRange(month, year);
    const holidays = await this.holidayRepository.find({
      where: { holidayDate: Between(from, to) },
    });

    return {
      weeklyDaysOff: new Set(weeklyDaysOff),
      holidayDates: new Set(holidays.map((holiday) => holiday.holidayDate)),
    };
  }

  private async recalculateExistingAttendancePeriods() {
    const summaries = await this.summaryRepository.find();
    const periodKeys = Array.from(new Set(summaries.map((summary) => getPeriodKey(summary.workDate))));
    await this.recalculateAttendancePeriods(periodKeys);
  }

  private async recalculateAttendancePeriods(periodKeys: string[]) {
    const schedule = await this.getShiftSchedule();
    const uniquePeriodKeys = Array.from(new Set(periodKeys));

    for (const periodKey of uniquePeriodKeys) {
      const [year, month] = periodKey.split("-").map(Number);
      if (!Number.isFinite(month) || !Number.isFinite(year)) {
        continue;
      }

      const dateRange = getMonthRange(month, year);
      const [summaries, logs, workCalendar] = await Promise.all([
        this.summaryRepository.find({
          where: { workDate: Between(dateRange.from, dateRange.to) },
          relations: { employee: true },
        }),
        this.logRepository.find({
          where: { workDate: Between(dateRange.from, dateRange.to) },
          relations: { employee: true },
        }),
        this.getWorkCalendar(month, year),
      ]);
      const logsBySummaryKey = groupUniqueLogsByAttendanceKey(logs);
      const changedSummaries = summaries.flatMap((summary) => {
        const log = logsBySummaryKey.get(getAttendanceKey(summary.employee.id, summary.workDate));
        const parsedCell = this.parseLogShiftTimes(summary, log, schedule, workCalendar);
        if (!parsedCell) {
          return [];
        }

        applyParsedAttendance(summary, parsedCell);
        return [summary];
      });

      if (changedSummaries.length > 0) {
        await this.summaryRepository.save(changedSummaries);
      }
      await this.payrollService.recalculatePeriodIfUnlocked(month, year);
    }
  }

  private toSettingsDto(settings: AttendanceSetting): AttendanceSettingsDto {
    return {
      morningStart: settings.morningStart,
      morningEnd: settings.morningEnd,
      afternoonStart: settings.afternoonStart,
      afternoonEnd: settings.afternoonEnd,
      nightStart: settings.nightStart ?? DEFAULT_ATTENDANCE_SETTINGS.nightStart,
      nightEnd: settings.nightEnd ?? DEFAULT_ATTENDANCE_SETTINGS.nightEnd,
      overtimeRate: Number(settings.overtimeRate ?? DEFAULT_ATTENDANCE_SETTINGS.overtimeRate),
      holidayRate: Number(settings.holidayRate ?? DEFAULT_ATTENDANCE_SETTINGS.holidayRate),
      weeklyDaysOff: normalizeWeeklyDaysOff(settings.weeklyDaysOff),
    };
  }

  private async getPayrollMonthSetting(month: number, year: number) {
    const weeklyDaysOff = await this.getWeeklyDaysOff();
    const holidayStats = await this.getPaidHolidayStats(month, year, weeklyDaysOff);
    const holidayPaidDays = holidayStats.paidDays;
    const standardWorkDay = countStandardWorkDays(month, year, weeklyDaysOff);

    return {
      month,
      year,
      standardWorkDay,
      holidayPaidDays,
      holidayBonusAmount: holidayPaidDays > 0 ? roundCurrency(holidayStats.bonusTotal / holidayPaidDays) : 0,
      holidayBonusTotal: holidayStats.bonusTotal,
    };
  }

  private toMonthSettingDto(
    settings: AttendanceMonthSetting | undefined,
    month: number,
    year: number,
    weeklyDaysOff: number[] = DEFAULT_WEEKLY_DAYS_OFF,
  ): PayrollMonthSetting {
    const holidayPaidDays = Number(settings?.holidayPaidDays ?? 0);
    const holidayBonusAmount = Number(settings?.holidayBonusAmount ?? 0);

    return {
      month,
      year,
      standardWorkDay: Number(settings?.standardWorkDay ?? countStandardWorkDays(month, year, weeklyDaysOff)),
      holidayPaidDays,
      holidayBonusAmount,
      holidayBonusTotal: roundCurrency(holidayPaidDays * holidayBonusAmount),
    };
  }

  private async getPaidHolidayStats(month: number, year: number, weeklyDaysOff: number[] = DEFAULT_WEEKLY_DAYS_OFF) {
    const { from, to } = getMonthRange(month, year);
    const holidays = await this.holidayRepository.find({
      where: { holidayDate: Between(from, to), isPaid: true },
    });
    const paidHolidays = holidays.filter((holiday) => !isWeeklyDayOff(holiday.holidayDate, weeklyDaysOff));
    return {
      paidDays: paidHolidays.length,
      bonusTotal: roundCurrency(sum(paidHolidays.map((holiday) => Number(holiday.bonusAmount ?? 0)))),
    };
  }

  private toSummaryDto(summary: AttendanceSummary, parsedFallback?: ParsedAttendanceCell) {
    return {
      id: summary.id,
      employeeId: summary.employee.id,
      employeeCode: summary.employee.employeeCode,
      employeeName: summary.employee.fullName,
      workDate: summary.workDate,
      checkInAt: toAttendanceDateTimeString(summary.workDate, parsedFallback?.times[0]) ?? toLocalDateTimeString(summary.checkInAt),
      checkOutAt:
        toAttendanceDateTimeString(summary.workDate, parsedFallback?.times[parsedFallback.times.length - 1]) ??
        toLocalDateTimeString(summary.checkOutAt),
      morningCheckInAt:
        toAttendanceDateTimeString(summary.workDate, parsedFallback?.shifts.morningIn) ??
        toLocalDateTimeString(summary.morningCheckInAt),
      morningCheckOutAt:
        toAttendanceDateTimeString(summary.workDate, parsedFallback?.shifts.morningOut) ??
        toLocalDateTimeString(summary.morningCheckOutAt),
      afternoonCheckInAt:
        toAttendanceDateTimeString(summary.workDate, parsedFallback?.shifts.afternoonIn) ??
        toLocalDateTimeString(summary.afternoonCheckInAt),
      afternoonCheckOutAt:
        toAttendanceDateTimeString(summary.workDate, parsedFallback?.shifts.afternoonOut) ??
        toLocalDateTimeString(summary.afternoonCheckOutAt),
      nightCheckInAt:
        toAttendanceDateTimeString(summary.workDate, parsedFallback?.shifts.nightIn) ??
        toLocalDateTimeString(summary.nightCheckInAt),
      nightCheckOutAt:
        toAttendanceDateTimeString(summary.workDate, parsedFallback?.shifts.nightOut) ??
        toLocalDateTimeString(summary.nightCheckOutAt),
      lateMinutes: parsedFallback?.lateMinutes ?? summary.lateMinutes,
      earlyLeaveMinutes: parsedFallback?.earlyLeaveMinutes ?? summary.earlyLeaveMinutes,
      overtimeMinutes: parsedFallback?.overtimeMinutes ?? summary.overtimeMinutes,
      workDay: parsedFallback?.workDay ?? Number(summary.workDay),
      status: parsedFallback?.status ?? summary.status,
    };
  }

  private parseLogShiftTimes(
    summary: AttendanceSummary,
    log: AttendanceLog | undefined,
    schedule: ShiftSchedule,
    workCalendar: WorkCalendar,
  ) {
    if (!log?.rawPayload || typeof log.rawPayload !== "object") {
      return undefined;
    }

    const rawValue = "value" in log.rawPayload ? log.rawPayload.value : undefined;
    if (typeof rawValue !== "string" || !rawValue.trim()) {
      return undefined;
    }

    const [year, month, day] = summary.workDate.split("-").map(Number);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return undefined;
    }

    return parseAttendanceCell(rawValue, year, month, day, summary.employee.shiftCount, schedule, {
      isNonWorkingDay: isNonWorkingDate(summary.workDate, workCalendar),
    });
  }

  private mergeManualAttendance(
    summary: AttendanceSummary,
    rowInput: UpdateAttendanceSummaryRowDto,
    schedule: ShiftSchedule,
    workCalendar: WorkCalendar,
  ) {
    const [year, month, day] = summary.workDate.split("-").map(Number);
    const value = buildManualAttendanceValue(rowInput);
    const parsedCell = parseAttendanceCell(value, year, month, day, summary.employee.shiftCount, schedule, {
      isNonWorkingDay: isNonWorkingDate(summary.workDate, workCalendar),
    });

    applyParsedAttendance(summary, parsedCell);
  }

  private async upsertManualAttendanceLog(
    summary: AttendanceSummary,
    rowInput: UpdateAttendanceSummaryRowDto | undefined,
    schedule: ShiftSchedule,
    workCalendar: WorkCalendar,
  ) {
    if (!rowInput) {
      return;
    }

    const [year, month, day] = summary.workDate.split("-").map(Number);
    const value = buildManualAttendanceValue(rowInput);
    const parsedCell = parseAttendanceCell(value, year, month, day, summary.employee.shiftCount, schedule, {
      isNonWorkingDay: isNonWorkingDate(summary.workDate, workCalendar),
    });
    const existingLog = await this.logRepository.findOne({
      where: {
        employee: { id: summary.employee.id },
        workDate: summary.workDate,
      },
      relations: { employee: true },
    });
    const log = existingLog ?? this.logRepository.create({ employee: summary.employee, workDate: summary.workDate });

    this.logRepository.merge(log, {
      source: "manual",
      checkInAt: parsedCell.checkInAt,
      checkOutAt: parsedCell.checkOutAt,
      rawPayload: {
        ...(existingLog?.rawPayload ?? {}),
        employeeCode: summary.employee.employeeCode,
        employeeName: summary.employee.fullName,
        date: summary.workDate,
        value,
        times: parsedCell.times,
        shifts: parsedCell.shifts,
        source: "manual",
      },
    });

    await this.logRepository.save(log);
  }

  private async buildPreview(
    rows: unknown[][],
    importYear: number,
    importMonthInput: number | undefined,
    schedule: ShiftSchedule,
  ) {
    if (rows.length < 2) {
      throw new HttpError(422, "INVALID_ATTENDANCE_FILE", "File chấm công không có dòng dữ liệu");
    }

    const attendanceHeader = findAttendanceHeader(rows, importMonthInput);
    const { codeIndex, nameIndex, dateColumns } = attendanceHeader;

    const importedMonths = Array.from(new Set(dateColumns.map((column) => column.month)));
    if (importedMonths.length !== 1) {
      throw new HttpError(422, "INVALID_ATTENDANCE_FILE", "Mỗi lần nhập chấm công chỉ được chứa một tháng");
    }

    const month = importMonthInput ?? importedMonths[0] ?? getVietnamDateParts().month;
    const workCalendar = await this.getWorkCalendar(month, importYear);
    const employees = await this.employeeRepository.find({ relations: { department: true, position: true } });
    const employeeMap = createEmployeeMap(employees);
    const previewRows: AttendancePreviewRow[] = [];

    for (const row of rows.slice(attendanceHeader.rowIndex + 1)) {
      const rawCode = stringCell(row[codeIndex]);
      const rawName = stringCell(row[nameIndex]);
      if (!rawCode && !rawName) {
        continue;
      }

      const matchedEmployee = findEmployeeByAttendanceCode(employeeMap, rawCode);
      const shiftCount = matchedEmployee?.shiftCount ?? 2;
      const days = dateColumns
        .map((column) => {
          const value = stringCell(row[column.index]);
          const date = formatDate(importYear, column.month, column.day);
          const parsedCell = parseAttendanceCell(value, importYear, column.month, column.day, shiftCount, schedule, {
            isNonWorkingDay: isNonWorkingDate(date, workCalendar),
          });
          return {
            date,
            column: column.label,
            value,
            times: parsedCell.times,
            workDay: parsedCell.workDay,
            lateMinutes: parsedCell.lateMinutes,
            earlyLeaveMinutes: parsedCell.earlyLeaveMinutes,
            overtimeMinutes: parsedCell.overtimeMinutes,
            status: parsedCell.status,
            hasData: parsedCell.hasData,
          };
        })
        .filter((day) => day.hasData)
        .map((day) => ({
          date: day.date,
          column: day.column,
          value: day.value,
          times: day.times,
          workDay: day.workDay,
          lateMinutes: day.lateMinutes,
          earlyLeaveMinutes: day.earlyLeaveMinutes,
          overtimeMinutes: day.overtimeMinutes,
          status: day.status,
        }));

      if (days.length === 0) {
        continue;
      }

      previewRows.push({
        employeeCode: rawCode,
        employeeName: rawName,
        matchedEmployeeId: matchedEmployee?.id,
        matchedEmployeeCode: matchedEmployee?.employeeCode,
        matchedEmployeeName: matchedEmployee?.fullName,
        days,
      });
    }

    const payrollMonthSetting = await this.getPayrollMonthSetting(month, importYear);
    const payrollPreview = await this.buildPayrollPreview(previewRows, employeeMap, payrollMonthSetting);

    return {
      month,
      year: importYear,
      rows: previewRows,
      payrollPreview,
      totals: {
        employees: previewRows.length,
        attendanceRows: sum(previewRows.map((row) => row.days.length)),
        unmatchedRows: previewRows.filter((row) => !row.matchedEmployeeId).length,
      },
    };
  }

  private async buildPayrollPreview(
    previewRows: AttendancePreviewRow[],
    employeeMap: EmployeeLookupMap,
    monthSetting: PayrollMonthSetting,
  ): Promise<AttendancePayrollPreview> {
    const standardWorkDay = monthSetting.standardWorkDay;
    const records = previewRows.map((row) => {
      const employee = findEmployeeByAttendanceCode(employeeMap, row.employeeCode);
      const configuredSalary = Number(employee?.baseSalary ?? 0);
      const workDay = roundNumber(sum(row.days.map((day) => Number(day.workDay))));

      return buildAttendancePayPreviewRecord({
        employeeId: employee?.id,
        employeeCode: employee?.employeeCode ?? row.employeeCode,
        employeeName: employee?.fullName ?? row.employeeName,
        departmentName: employee?.department?.name,
        positionName: employee?.position?.name,
        email: employee?.email,
        configuredSalary,
        workDay,
        standardWorkDay,
      });
    });

    return {
      records,
      totals: {
        employeeCount: records.length,
        workDay: roundNumber(sum(records.map((record) => record.workDay))),
        netSalary: roundCurrency(sum(records.map((record) => record.netSalary))),
      },
    };
  }

  private async commitPreviewRows(input: ConfirmAttendanceImportInput) {
    if (input.rows.length === 0) {
      throw new HttpError(422, "NO_ATTENDANCE_IMPORTED", "Chưa có dòng preview để nhập");
    }

    const employees = await this.employeeRepository.find();
    const employeeMap = createEmployeeMap(employees);
    const schedule = await this.getShiftSchedule();
    const workCalendar = await this.getWorkCalendar(input.month, input.year);
    const summaryRows: AttendanceSummary[] = [];
    const logRows: AttendanceLog[] = [];
    const unmatchedRows: Array<{ code: string; name: string }> = [];
    let createdEmployees = 0;

    for (const row of input.rows) {
      const attendanceDays = row.days.filter((day) => hasAttendanceValue(day.value));

      if (attendanceDays.length === 0) {
        continue;
      }

      let employee = findEmployeeByAttendanceCode(employeeMap, row.employeeCode);
      if (!employee && input.autoCreateMissingEmployees !== false && row.employeeCode && row.employeeName) {
        employee = await this.createImportedEmployee(row.employeeCode, row.employeeName, input.year, input.month);
        employees.push(employee);
        addEmployeeToMap(employeeMap, employee);
        createdEmployees += 1;
      }

      if (!employee) {
        unmatchedRows.push({ code: row.employeeCode, name: row.employeeName });
        continue;
      }

      for (const day of attendanceDays) {
        const [rawYear, rawMonth, rawDayOfMonth] = day.date.split("-").map(Number);
        const year = Number.isFinite(rawYear) ? rawYear : input.year;
        const month = Number.isFinite(rawMonth) ? rawMonth : input.month;
        const dayOfMonth = Number.isFinite(rawDayOfMonth) ? rawDayOfMonth : 1;
        const workDate = formatDate(year, month, dayOfMonth);
        const parsedCell = parseAttendanceCell(day.value, year, month, dayOfMonth, employee.shiftCount, schedule, {
          isNonWorkingDay: isNonWorkingDate(workDate, workCalendar),
        });
        if (!parsedCell.hasData) {
          continue;
        }

        summaryRows.push(
          this.summaryRepository.create({
            employee,
            workDate,
            checkInAt: parsedCell.checkInAt,
            checkOutAt: parsedCell.checkOutAt,
            morningCheckInAt: parsedCell.morningCheckInAt,
            morningCheckOutAt: parsedCell.morningCheckOutAt,
            afternoonCheckInAt: parsedCell.afternoonCheckInAt,
            afternoonCheckOutAt: parsedCell.afternoonCheckOutAt,
            nightCheckInAt: parsedCell.nightCheckInAt,
            nightCheckOutAt: parsedCell.nightCheckOutAt,
            lateMinutes: parsedCell.lateMinutes,
            earlyLeaveMinutes: parsedCell.earlyLeaveMinutes,
            overtimeMinutes: parsedCell.overtimeMinutes,
            workDay: String(parsedCell.workDay),
            status: parsedCell.status,
          }),
        );
        logRows.push(
          this.logRepository.create({
            employee,
            source: "file",
            workDate,
            checkInAt: parsedCell.checkInAt,
            checkOutAt: parsedCell.checkOutAt,
            rawPayload: {
              employeeCode: row.employeeCode,
              employeeName: row.employeeName,
              date: workDate,
              value: day.value,
              times: parsedCell.times,
              shifts: parsedCell.shifts,
              column: day.column,
              fileName: input.fileName,
            },
          }),
        );
      }
    }

    if (summaryRows.length === 0) {
      throw new HttpError(422, "NO_ATTENDANCE_IMPORTED", "Không có dòng chấm công nào khớp nhân viên");
    }

    const employeeIds = Array.from(new Set(summaryRows.map((summary) => summary.employee.id)));
    const dateRange = getMonthRange(input.month, input.year);
    await Promise.all([
      this.summaryRepository
        .createQueryBuilder()
        .delete()
        .from(AttendanceSummary)
        .where("employeeId IN (:...employeeIds)", { employeeIds })
        .andWhere("work_date BETWEEN :from AND :to", dateRange)
        .execute(),
      this.logRepository
        .createQueryBuilder()
        .delete()
        .from(AttendanceLog)
        .where("employeeId IN (:...employeeIds)", { employeeIds })
        .andWhere("work_date BETWEEN :from AND :to", dateRange)
        .execute(),
    ]);

    await this.summaryRepository.save(summaryRows);
    await this.logRepository.save(logRows);
    const payroll = await this.payrollService.calculatePeriod({ month: input.month, year: input.year });

    return {
      fileName: input.fileName,
      month: input.month,
      year: input.year,
      importedEmployees: employeeIds.length,
      createdEmployees,
      attendanceRows: summaryRows.length,
      attendanceLogs: logRows.length,
      unmatchedRows,
      payroll,
    };
  }
}

function parseWorkbookRows(file: Express.Multer.File) {
  const workbook = XLSX.read(file.buffer, {
    type: "buffer",
    cellDates: false,
    raw: false,
  });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new HttpError(422, "INVALID_ATTENDANCE_FILE", "File chấm công không có sheet dữ liệu");
  }

  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  }) as unknown[][];
}

function findHeaderIndex(header: unknown[], names: string[]) {
  const normalizedNames = names.map(normalizeKey);
  return header.findIndex((cell) => normalizedNames.includes(normalizeKey(stringCell(cell))));
}

function findAttendanceHeader(rows: unknown[][], selectedMonth?: number): AttendanceHeader {
  const codeHeaderNames = [
    "mã nhân viên",
    "ma nhan vien",
    "mã nv",
    "ma nv",
    "mã",
    "ma",
    "employee code",
    "code",
    "id",
  ];
  const nameHeaderNames = [
    "tên",
    "ten",
    "họ tên",
    "ho ten",
    "họ và tên",
    "ho va ten",
    "nhân viên",
    "nhan vien",
    "employee name",
    "name",
  ];

  for (const [rowIndex, header] of rows.entries()) {
    const codeIndex = findHeaderIndex(header, codeHeaderNames);
    const nameIndex = findHeaderIndex(header, nameHeaderNames);
    if (codeIndex < 0 || nameIndex < 0) {
      continue;
    }

    const dateColumns = parseDateColumns(header, selectedMonth);
    if (dateColumns.length > 0) {
      return {
        rowIndex,
        codeIndex,
        nameIndex,
        dateColumns,
      };
    }
  }

  throw new HttpError(
    422,
    "INVALID_ATTENDANCE_FILE",
    "File phải có dòng tiêu đề gồm mã nhân viên, tên nhân viên và các cột ngày",
  );
}

function parseDateColumns(header: unknown[], selectedMonth?: number) {
  const columns = header
    .map((cell, index) => ({ cell, index }))
    .map(({ cell, index }) => ({ parsed: parseDateHeader(cell, selectedMonth), index }))
    .filter((item): item is { parsed: Omit<ParsedDateColumn, "index">; index: number } => Boolean(item.parsed))
    .map(({ parsed, index }) => ({ ...parsed, index }));

  if (selectedMonth !== undefined) {
    const mismatchedMonth = columns.find((column) => column.month !== selectedMonth);
    if (mismatchedMonth) {
      throw new HttpError(
        422,
        "INVALID_ATTENDANCE_FILE",
        `File có cột ngày thuộc tháng ${String(mismatchedMonth.month).padStart(2, "0")}, không khớp kỳ chấm công ${String(selectedMonth).padStart(2, "0")}`,
      );
    }
  }

  const duplicateDates = findDuplicateDateColumns(columns);
  if (duplicateDates.length > 0) {
    throw new HttpError(
      422,
      "INVALID_ATTENDANCE_FILE",
      `File có cột ngày bị trùng: ${duplicateDates.join(", ")}`,
    );
  }

  return columns;
}

function parseDateHeader(value: unknown, selectedMonth?: number): Omit<ParsedDateColumn, "index"> | null {
  const label = stringCell(value);
  const match = label.match(/^(\d{1,2})(?:[-/](\d{1,2}))?$/);
  if (!match) {
    return null;
  }

  const first = Number(match[1]);
  const second = match[2] ? Number(match[2]) : undefined;
  const inferredMonth = getHeaderMonth(first, second);
  const month =
    selectedMonth !== undefined && second === undefined
      ? selectedMonth
      : getHeaderMonthForSelectedMonth(first, second, selectedMonth) ?? inferredMonth;
  const day = getHeaderDay(first, second, month, selectedMonth);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return { month, day, label };
}

function getHeaderMonth(first: number, second?: number) {
  if (second === undefined) {
    return 0;
  }

  return first > 12 ? second : first;
}

function getHeaderMonthForSelectedMonth(first: number, second: number | undefined, selectedMonth?: number) {
  if (selectedMonth === undefined || second === undefined) {
    return undefined;
  }

  if (first === selectedMonth || second === selectedMonth) {
    return selectedMonth;
  }

  return undefined;
}

function getHeaderDay(first: number, second: number | undefined, month: number, selectedMonth?: number) {
  if (second === undefined) {
    return selectedMonth ? first : 0;
  }

  if (selectedMonth && first === selectedMonth) {
    return second;
  }

  if (selectedMonth && second === selectedMonth) {
    return first;
  }

  if (first > 12) {
    return first;
  }

  if (second > 12) {
    return second;
  }

  return month === first ? second : first;
}

function findDuplicateDateColumns(columns: ParsedDateColumn[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const column of columns) {
    const key = `${String(column.month).padStart(2, "0")}/${String(column.day).padStart(2, "0")}`;
    if (seen.has(key)) {
      duplicates.add(key);
    }
    seen.add(key);
  }

  return Array.from(duplicates);
}

function hasAttendanceValue(value: string) {
  const normalizedValue = normalizeKey(value);
  return (
    normalizedValue.includes("ca ngay") ||
    normalizedValue.includes("full day") ||
    /(\d{1,2})[:h](\d{2})/.test(value)
  );
}

function parseAttendanceCell(
  value: string,
  year: number,
  month: number,
  day: number,
  shiftCount = 2,
  schedule = toShiftSchedule(DEFAULT_ATTENDANCE_SETTINGS),
  options: ParseAttendanceOptions = {},
): ParsedAttendanceCell {
  const normalizedValue = normalizeKey(value);
  const isFullDayLeave = normalizedValue.includes("ca ngay") || normalizedValue.includes("full day");
  const times = Array.from(value.matchAll(/(\d{1,2})[:h](\d{2})/g))
    .map((match) => ({
      hour: Number(match[1]),
      minute: Number(match[2]),
    }))
    .filter((time) => time.hour >= 0 && time.hour <= 23 && time.minute >= 0 && time.minute <= 59)
    .map((time) => time.hour * 60 + time.minute)
    .sort((left, right) => left - right);
  const uniqueTimes = times.filter((time, index, list) => list[index - 1] !== time);
  const sessions = buildShiftSessions(uniqueTimes, shiftCount, schedule);
  const first = uniqueTimes[0];
  const last = uniqueTimes[uniqueTimes.length - 1];
  const hasData = isFullDayLeave || uniqueTimes.length > 0;
  const checkInAt = first === undefined ? null : dateFromMinutes(year, month, day, first);
  const checkOutAt = last === undefined ? null : dateFromMinutes(year, month, day, last);
  const morningCheckInAt =
    sessions.morningIn === null ? null : dateFromMinutes(year, month, day, sessions.morningIn);
  const morningCheckOutAt =
    sessions.morningOut === null ? null : dateFromMinutes(year, month, day, sessions.morningOut);
  const afternoonCheckInAt =
    sessions.afternoonIn === null ? null : dateFromMinutes(year, month, day, sessions.afternoonIn);
  const afternoonCheckOutAt =
    sessions.afternoonOut === null ? null : dateFromMinutes(year, month, day, sessions.afternoonOut);
  const nightCheckInAt = sessions.nightIn === null ? null : dateFromMinutes(year, month, day, sessions.nightIn);
  const nightCheckOutAt = sessions.nightOut === null ? null : dateFromMinutes(year, month, day, sessions.nightOut);
  const hasNightShift = shiftCount >= 3 || sessions.nightIn !== null || sessions.nightOut !== null;
  const rawLateMinutes = isFullDayLeave
    ? 0
    : getLateMinutes(sessions.morningIn, schedule.morningStart) +
      getLateMinutes(sessions.afternoonIn, schedule.afternoonStart) +
      (hasNightShift ? getLateMinutes(sessions.nightIn, schedule.nightStart) : 0);
  const rawEarlyLeaveMinutes = isFullDayLeave
    ? 0
    : getEarlyLeaveMinutes(sessions.morningOut, schedule.morningEnd) +
      getEarlyLeaveMinutes(sessions.afternoonOut, schedule.afternoonEnd) +
      (hasNightShift ? getEarlyLeaveMinutes(sessions.nightOut, schedule.nightEnd) : 0);
  const overtimeCheckOut = sessions.nightOut !== null ? sessions.nightOut : sessions.afternoonOut;
  const overtimeEnd = sessions.nightOut !== null ? schedule.nightEnd : schedule.afternoonEnd;
  const rawOvertimeMinutes = overtimeCheckOut === null || isFullDayLeave ? 0 : Math.max(0, overtimeCheckOut - overtimeEnd);
  const metrics = options.isNonWorkingDay
    ? calculateNonWorkingDayMetrics(uniqueTimes, schedule)
    : isFullDayLeave
      ? { lateMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0, workDay: 1 }
      : calculateAttendanceMetrics(sessions, shiftCount, schedule, {
          lateMinutes: rawLateMinutes,
          earlyLeaveMinutes: rawEarlyLeaveMinutes,
          overtimeMinutes: rawOvertimeMinutes,
        });

  return {
    hasData,
    times: uniqueTimes.map(formatMinutes),
    shifts: {
      morningIn: sessions.morningIn === null ? undefined : formatMinutes(sessions.morningIn),
      morningOut: sessions.morningOut === null ? undefined : formatMinutes(sessions.morningOut),
      afternoonIn: sessions.afternoonIn === null ? undefined : formatMinutes(sessions.afternoonIn),
      afternoonOut: sessions.afternoonOut === null ? undefined : formatMinutes(sessions.afternoonOut),
      nightIn: sessions.nightIn === null ? undefined : formatMinutes(sessions.nightIn),
      nightOut: sessions.nightOut === null ? undefined : formatMinutes(sessions.nightOut),
    },
    checkInAt,
    checkOutAt,
    morningCheckInAt,
    morningCheckOutAt,
    afternoonCheckInAt,
    afternoonCheckOutAt,
    nightCheckInAt,
    nightCheckOutAt,
    lateMinutes: metrics.lateMinutes,
    earlyLeaveMinutes: metrics.earlyLeaveMinutes,
    overtimeMinutes: metrics.overtimeMinutes,
    workDay: metrics.workDay,
    status: !hasData ? "missing_punch" : isFullDayLeave ? "leave" : sessions.isMissingPunch ? "missing_punch" : "present",
  };
}

function parseYunattAdminBodyRows(body: unknown): YunattAdminBodyRow[] {
  const parsedBody = typeof body === "string" ? parseJsonBody(body) : body;
  const rows = Array.isArray(parsedBody) ? parsedBody : isRecord(parsedBody) ? parsedBody.rows : undefined;

  if (!Array.isArray(rows)) {
    throw new HttpError(422, "INVALID_YUNATT_BODY", "Body admin phải có dạng JSON chứa mảng rows");
  }

  return rows.filter(isRecord) as YunattAdminBodyRow[];
}

function parseJsonBody(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new HttpError(422, "INVALID_YUNATT_BODY", "Body admin không phải JSON hợp lệ");
  }
}

function buildPreviewDaysFromYunattRow(
  row: YunattAdminBodyRow,
  year: number,
  month: number,
  shiftCount: number,
  schedule: ShiftSchedule,
  workCalendar: WorkCalendar,
): AttendancePreviewDay[] {
  return Object.entries(row)
    .map(([key, value]) => {
      const matchedDate = key.match(/^day-(\d{4})-(\d{2})-(\d{2})$/);
      if (!matchedDate) {
        return null;
      }

      const rowYear = Number(matchedDate[1]);
      const rowMonth = Number(matchedDate[2]);
      const rowDay = Number(matchedDate[3]);
      if (rowYear !== year || rowMonth !== month || rowDay < 1 || rowDay > 31) {
        return null;
      }

      const cellValue = normalizeYunattDayValue(value);
      const date = formatDate(year, month, rowDay);
      const parsedCell = parseAttendanceCell(cellValue, year, month, rowDay, shiftCount, schedule, {
        isNonWorkingDay: isNonWorkingDate(date, workCalendar),
      });
      if (!parsedCell.hasData) {
        return null;
      }

      return {
        date,
        column: `${String(month).padStart(2, "0")}-${String(rowDay).padStart(2, "0")}`,
        value: cellValue,
        times: parsedCell.times,
        workDay: parsedCell.workDay,
        lateMinutes: parsedCell.lateMinutes,
        earlyLeaveMinutes: parsedCell.earlyLeaveMinutes,
        overtimeMinutes: parsedCell.overtimeMinutes,
        status: parsedCell.status,
      };
    })
    .filter((day): day is AttendancePreviewDay => day !== null)
    .sort((left, right) => left.date.localeCompare(right.date));
}

function normalizeYunattDayValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(stringCell).filter(Boolean).join("\n");
  }

  return stringCell(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{2,}/g, "\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildShiftSessions(times: number[], shiftCount = 2, schedule: ShiftSchedule): ShiftSessions {
  if (shiftCount <= 1) {
    return buildSingleShiftSession(times);
  }

  const sessions: ShiftSessions = {
    morningIn: null,
    morningOut: null,
    afternoonIn: null,
    afternoonOut: null,
    nightIn: null,
    nightOut: null,
    workDay: 0,
    isMissingPunch: false,
  };

  if (times.length === 0) {
    return sessions;
  }

  if (shiftCount >= 3) {
    return buildGroupedThreeShiftSessions(times, schedule);
  }

  const nightAwareSessions = buildNightAwareTwoShiftSessions(times, schedule);
  if (nightAwareSessions) {
    return nightAwareSessions;
  }

  const groupedSessions = buildGroupedTwoShiftSessions(times, schedule);
  if (groupedSessions) {
    return groupedSessions;
  }

  const firstLastSession = buildFirstLastTwoShiftSession(times, schedule);
  if (firstLastSession) {
    return firstLastSession;
  }

  if (times.length >= 4) {
    sessions.morningIn = times[0] ?? null;
    sessions.morningOut = times[1] ?? null;
    sessions.afternoonIn = times[2] ?? null;
    sessions.afternoonOut = times[times.length - 1] ?? null;
    sessions.workDay = 1;
    sessions.isMissingPunch = false;
    return sessions;
  }

  if (times.length === 2) {
    const [first, second] = times;
    if (
      first !== undefined &&
      second !== undefined &&
      first <= schedule.noLunchPunchMorningLimit &&
      second >= schedule.noLunchPunchAfternoonLimit
    ) {
      sessions.morningIn = first;
      sessions.afternoonOut = second;
      sessions.workDay = 1;
      sessions.isMissingPunch = false;
      return sessions;
    }

    if (second !== undefined && second <= schedule.afternoonStart) {
      sessions.morningIn = first ?? null;
      sessions.morningOut = second;
      sessions.workDay = 0.5;
      sessions.isMissingPunch = false;
      return sessions;
    }

    sessions.afternoonIn = first ?? null;
    sessions.afternoonOut = second ?? null;
    sessions.workDay = 0.5;
    sessions.isMissingPunch = false;
    return sessions;
  }

  if (times.length === 3) {
    const [first, second, third] = times;
    sessions.workDay = spansFullDay(times, schedule) ? 1 : 0.5;
    sessions.isMissingPunch = true;

    if (first !== undefined && first < schedule.morningEnd) {
      sessions.morningIn = first;
    }
    if (second !== undefined && second <= schedule.afternoonStart) {
      sessions.morningOut = second;
    } else if (second !== undefined) {
      sessions.afternoonIn = second;
    }
    if (third !== undefined && third >= schedule.afternoonStart) {
      if (sessions.afternoonIn === null) {
        sessions.afternoonIn = third;
      } else {
        sessions.afternoonOut = third;
      }
    } else if (third !== undefined) {
      sessions.morningOut = third;
    }

    return sessions;
  }

  sessions.isMissingPunch = true;
  const only = times[0];
  if (only !== undefined && only < schedule.afternoonStart) {
    sessions.morningIn = only;
  } else {
    sessions.afternoonIn = only ?? null;
  }
  sessions.workDay = 0.5;
  return sessions;
}

function buildFirstLastTwoShiftSession(times: number[], schedule: ShiftSchedule): ShiftSessions | null {
  const first = times[0];
  const last = times[times.length - 1];
  if (first === undefined || last === undefined) {
    return null;
  }

  const expectedWorkMinutes = getExpectedTwoDayShiftMinutes(schedule);
  const workedMinutes = getFirstLastTwoShiftWorkedMinutes(first, last, schedule);
  if (expectedWorkMinutes <= 0 || workedMinutes < expectedWorkMinutes) {
    return null;
  }

  return {
    morningIn: first,
    morningOut: null,
    afternoonIn: null,
    afternoonOut: last,
    nightIn: null,
    nightOut: null,
    workDay: 1,
    isMissingPunch: false,
  };
}

function calculateAttendanceMetrics(
  sessions: ShiftSessions,
  shiftCount: number,
  schedule: ShiftSchedule,
  rawMetrics: Pick<ParsedAttendanceCell, "lateMinutes" | "earlyLeaveMinutes" | "overtimeMinutes">,
) {
  if (shiftCount > 2 || sessions.nightIn !== null || sessions.nightOut !== null || sessions.isMissingPunch) {
    return { ...rawMetrics, workDay: sessions.workDay };
  }

  const expectedWorkMinutes = getExpectedTwoDayShiftMinutes(schedule);
  const workedMinutes = getWorkedTwoDayShiftMinutes(sessions, schedule);
  if (expectedWorkMinutes <= 0 || workedMinutes <= 0) {
    return { ...rawMetrics, workDay: sessions.workDay };
  }

  const baseWorkedMinutes = Math.max(0, expectedWorkMinutes - rawMetrics.lateMinutes - rawMetrics.earlyLeaveMinutes);
  let compensationMinutes = Math.max(0, workedMinutes - baseWorkedMinutes);
  const lateCompensationMinutes = Math.min(rawMetrics.lateMinutes, compensationMinutes);
  const lateMinutes = rawMetrics.lateMinutes - lateCompensationMinutes;
  compensationMinutes -= lateCompensationMinutes;
  const earlyLeaveCompensationMinutes = Math.min(rawMetrics.earlyLeaveMinutes, compensationMinutes);
  const earlyLeaveMinutes = rawMetrics.earlyLeaveMinutes - earlyLeaveCompensationMinutes;

  return {
    lateMinutes,
    earlyLeaveMinutes,
    overtimeMinutes: Math.max(0, workedMinutes - expectedWorkMinutes),
    workDay: Math.min(1, roundNumber(workedMinutes / expectedWorkMinutes)),
  };
}

function calculateNonWorkingDayMetrics(uniqueTimes: number[], schedule: ShiftSchedule) {
  return {
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    overtimeMinutes: getNonWorkingDayWorkedMinutes(uniqueTimes, schedule),
    workDay: 0,
  };
}

function getNonWorkingDayWorkedMinutes(uniqueTimes: number[], schedule: ShiftSchedule) {
  const first = uniqueTimes[0];
  const last = uniqueTimes[uniqueTimes.length - 1];
  if (first === undefined || last === undefined || first === last) {
    return 0;
  }

  const lunchBreak =
    first < schedule.afternoonStart && last > schedule.morningEnd
      ? Math.max(0, schedule.afternoonStart - schedule.morningEnd)
      : 0;
  const dinnerBreak =
    first < schedule.nightStart && last > schedule.afternoonEnd
      ? Math.max(0, schedule.nightStart - schedule.afternoonEnd)
      : 0;

  return Math.max(0, last - first - lunchBreak - dinnerBreak);
}

function getExpectedTwoDayShiftMinutes(schedule: ShiftSchedule) {
  return Math.max(0, schedule.morningEnd - schedule.morningStart) + Math.max(0, schedule.afternoonEnd - schedule.afternoonStart);
}

function getFirstLastTwoShiftWorkedMinutes(first: number, last: number, schedule: ShiftSchedule) {
  const breakMinutes =
    first < schedule.afternoonStart && last > schedule.morningEnd
      ? Math.max(0, schedule.afternoonStart - schedule.morningEnd)
      : 0;
  return Math.max(0, last - Math.max(first, schedule.morningStart) - breakMinutes);
}

function getWorkedTwoDayShiftMinutes(sessions: ShiftSessions, schedule: ShiftSchedule) {
  const hasFullDayWithoutLunchPunches =
    sessions.morningIn !== null &&
    sessions.morningOut === null &&
    sessions.afternoonIn === null &&
    sessions.afternoonOut !== null;

  if (hasFullDayWithoutLunchPunches) {
    const morningIn = sessions.morningIn;
    const afternoonOut = sessions.afternoonOut;
    if (morningIn === null || afternoonOut === null) {
      return 0;
    }

    const breakMinutes = Math.max(0, schedule.afternoonStart - schedule.morningEnd);
    return Math.max(0, afternoonOut - Math.max(morningIn, schedule.morningStart) - breakMinutes);
  }

  return (
    getWorkedShiftMinutes(sessions.morningIn, sessions.morningOut, schedule.morningStart) +
    getWorkedShiftMinutes(sessions.afternoonIn, sessions.afternoonOut, schedule.afternoonStart)
  );
}

function getWorkedShiftMinutes(checkIn: number | null, checkOut: number | null, expectedStart: number) {
  if (checkIn === null || checkOut === null) {
    return 0;
  }

  return Math.max(0, checkOut - Math.max(checkIn, expectedStart));
}

function buildGroupedTwoShiftSessions(times: number[], schedule: ShiftSchedule): ShiftSessions | null {
  const morningTimes = times.filter((time) => time < schedule.lunchSplit);
  const afternoonTimes = times.filter((time) => time >= schedule.lunchSplit);

  if (morningTimes.length < 2 || afternoonTimes.length < 2) {
    return null;
  }

  return {
    morningIn: morningTimes[0] ?? null,
    morningOut: morningTimes[morningTimes.length - 1] ?? null,
    afternoonIn: afternoonTimes[0] ?? null,
    afternoonOut: afternoonTimes[afternoonTimes.length - 1] ?? null,
    nightIn: null,
    nightOut: null,
    workDay: 1,
    isMissingPunch: false,
  };
}

function buildGroupedThreeShiftSessions(times: number[], schedule: ShiftSchedule): ShiftSessions {
  const extractedNight = extractNightShiftTail(times, schedule);
  const remainingTimes = extractedNight ? extractedNight.remainingTimes : times;
  const morningTimes = remainingTimes.filter((time) => time < schedule.lunchSplit);
  const afternoonTimes = remainingTimes.filter((time) => time >= schedule.lunchSplit && time < schedule.dinnerSplit);
  const nightTimes = extractedNight?.nightTimes ?? remainingTimes.filter((time) => time >= schedule.dinnerSplit);
  const shiftGroups = [morningTimes, afternoonTimes, nightTimes];
  const completeShiftCount = shiftGroups.filter((group) => group.length >= 2).length;
  const partialShiftCount = shiftGroups.filter((group) => group.length === 1).length;

  return {
    morningIn: morningTimes[0] ?? null,
    morningOut: morningTimes.length >= 2 ? morningTimes[morningTimes.length - 1] ?? null : null,
    afternoonIn: afternoonTimes[0] ?? null,
    afternoonOut: afternoonTimes.length >= 2 ? afternoonTimes[afternoonTimes.length - 1] ?? null : null,
    nightIn: nightTimes[0] ?? null,
    nightOut: nightTimes.length >= 2 ? nightTimes[nightTimes.length - 1] ?? null : null,
    workDay: roundNumber(completeShiftCount / 3 + partialShiftCount / 6),
    isMissingPunch: completeShiftCount < 3 || partialShiftCount > 0,
  };
}

function buildNightAwareTwoShiftSessions(times: number[], schedule: ShiftSchedule): ShiftSessions | null {
  const extractedNight = extractNightShiftTail(times, schedule);
  if (!extractedNight) {
    return null;
  }

  const remainingTimes = extractedNight.remainingTimes;
  const sessions: ShiftSessions = {
    morningIn: null,
    morningOut: null,
    afternoonIn: null,
    afternoonOut: null,
    nightIn: extractedNight.nightTimes[0] ?? null,
    nightOut: extractedNight.nightTimes[extractedNight.nightTimes.length - 1] ?? null,
    workDay: 0,
    isMissingPunch: false,
  };

  const usedIndexes = new Set<number>();
  const morningIndexes = remainingTimes
    .map((time, index) => ({ time, index }))
    .filter(({ time }) => time < schedule.lunchSplit);
  if (morningIndexes.length >= 2) {
    const first = morningIndexes[0];
    const last = morningIndexes[morningIndexes.length - 1];
    sessions.morningIn = first?.time ?? null;
    sessions.morningOut = last?.time ?? null;
    if (first) {
      usedIndexes.add(first.index);
    }
    if (last) {
      usedIndexes.add(last.index);
    }
  } else if (morningIndexes.length === 1) {
    const first = morningIndexes[0];
    const next = remainingTimes.find((time, index) => index > first.index && time < schedule.afternoonEnd);
    sessions.morningIn = first.time;
    sessions.morningOut = next ?? null;
    usedIndexes.add(first.index);
    if (next !== undefined) {
      usedIndexes.add(remainingTimes.indexOf(next));
    }
  }

  const afternoonTimes = remainingTimes.filter(
    (time, index) => !usedIndexes.has(index) && time >= schedule.lunchSplit && time < schedule.afternoonEnd,
  );
  if (afternoonTimes.length >= 2) {
    sessions.afternoonIn = afternoonTimes[0] ?? null;
    sessions.afternoonOut = afternoonTimes[afternoonTimes.length - 1] ?? null;
  } else if (afternoonTimes.length === 1) {
    sessions.afternoonIn = afternoonTimes[0] ?? null;
  }

  const groups = [
    [sessions.morningIn, sessions.morningOut],
    [sessions.afternoonIn, sessions.afternoonOut],
    [sessions.nightIn, sessions.nightOut],
  ];
  const completeShiftCount = groups.filter(([checkIn, checkOut]) => checkIn !== null && checkOut !== null).length;
  const partialShiftCount = groups.filter(
    ([checkIn, checkOut]) => (checkIn !== null && checkOut === null) || (checkIn === null && checkOut !== null),
  ).length;

  sessions.workDay = Math.min(1, roundNumber(completeShiftCount / 2 + partialShiftCount / 4));
  sessions.isMissingPunch = partialShiftCount > 0 || completeShiftCount === 0;
  return sessions;
}

function extractNightShiftTail(times: number[], schedule: ShiftSchedule) {
  if (times.length < 2) {
    return null;
  }

  const lastIndex = times.length - 1;
  const nightOut = times[lastIndex];
  const nightIn = times[lastIndex - 1];
  if (
    nightOut === undefined ||
    nightIn === undefined ||
    nightOut < schedule.nightStart ||
    nightIn < schedule.afternoonEnd - 30
  ) {
    return null;
  }

  return {
    nightTimes: [nightIn, nightOut],
    remainingTimes: times.slice(0, -2),
  };
}

function buildSingleShiftSession(times: number[]): ShiftSessions {
  const sessions: ShiftSessions = {
    morningIn: null,
    morningOut: null,
    afternoonIn: null,
    afternoonOut: null,
    nightIn: null,
    nightOut: null,
    workDay: 0,
    isMissingPunch: false,
  };

  if (times.length === 0) {
    return sessions;
  }

  sessions.morningIn = times[0] ?? null;
  sessions.afternoonOut = times[times.length - 1] ?? null;
  sessions.workDay = times.length >= 2 ? 1 : 0.5;
  sessions.isMissingPunch = times.length < 2;

  return sessions;
}

function spansFullDay(times: number[], schedule: ShiftSchedule) {
  const first = times[0];
  const last = times[times.length - 1];
  return first !== undefined && last !== undefined && first <= schedule.morningEnd && last >= schedule.afternoonStart;
}

function getLateMinutes(actual: number | null, expected: number) {
  return actual === null ? 0 : Math.max(0, actual - expected);
}

function getEarlyLeaveMinutes(actual: number | null, expected: number) {
  return actual === null ? 0 : Math.max(0, expected - actual);
}

function validateAttendanceSettings(settings: AttendanceSettingsDto) {
  const schedule = toShiftSchedule(settings);
  if (schedule.morningStart >= schedule.morningEnd) {
    throw new HttpError(400, "INVALID_ATTENDANCE_SETTINGS", "Giờ vào ca sáng phải nhỏ hơn giờ ra ca sáng");
  }

  if (schedule.afternoonStart >= schedule.afternoonEnd) {
    throw new HttpError(400, "INVALID_ATTENDANCE_SETTINGS", "Giờ vào ca chiều phải nhỏ hơn giờ ra ca chiều");
  }

  if (schedule.morningEnd > schedule.afternoonStart) {
    throw new HttpError(400, "INVALID_ATTENDANCE_SETTINGS", "Giờ ra ca sáng phải nhỏ hơn hoặc bằng giờ vào ca chiều");
  }

  if (schedule.afternoonEnd > schedule.nightStart) {
    throw new HttpError(400, "INVALID_ATTENDANCE_SETTINGS", "Giờ ra ca chiều phải nhỏ hơn hoặc bằng giờ vào ca tối");
  }

  if (schedule.nightStart >= schedule.nightEnd) {
    throw new HttpError(400, "INVALID_ATTENDANCE_SETTINGS", "Giờ vào ca tối phải nhỏ hơn giờ ra ca tối");
  }
}

function toShiftSchedule(settings: AttendanceSettingsDto): ShiftSchedule {
  const morningStart = timeToMinutes(settings.morningStart);
  const morningEnd = timeToMinutes(settings.morningEnd);
  const afternoonStart = timeToMinutes(settings.afternoonStart);
  const afternoonEnd = timeToMinutes(settings.afternoonEnd);
  const nightStart = timeToMinutes(settings.nightStart);
  const nightEnd = timeToMinutes(settings.nightEnd);

  return {
    morningStart,
    morningEnd,
    afternoonStart,
    afternoonEnd,
    nightStart,
    nightEnd,
    lunchSplit: Math.round((morningEnd + afternoonStart) / 2),
    dinnerSplit: Math.round((afternoonEnd + nightStart) / 2),
    noLunchPunchMorningLimit: Math.round((morningStart + morningEnd) / 2),
    noLunchPunchAfternoonLimit: Math.round((afternoonStart + afternoonEnd) / 2),
  };
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    throw new HttpError(400, "INVALID_ATTENDANCE_SETTINGS", "Giờ làm việc không hợp lệ");
  }

  return hours * 60 + minutes;
}

function dateFromMinutes(year: number, month: number, day: number, minutes: number) {
  return new Date(Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60) - VIETNAM_TIMEZONE_OFFSET_MS);
}

function toAttendanceDateTimeString(workDate: string, time?: string) {
  return time ? `${workDate}T${time}:00` : undefined;
}

function toLocalDateTimeString(value?: Date | string | null) {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(" ", "T");
    if (!normalized) {
      return undefined;
    }

    return hasExplicitTimezone(normalized) ? toVietnamDateTimeString(new Date(normalized)) : normalized.slice(0, 19);
  }

  if (Number.isNaN(value.getTime())) {
    return undefined;
  }

  return toVietnamDateTimeString(value);
}

function hasExplicitTimezone(value: string) {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
}

function toVietnamDateTimeString(value: Date) {
  if (Number.isNaN(value.getTime())) {
    return undefined;
  }

  const vietnamTime = new Date(value.getTime() + VIETNAM_TIMEZONE_OFFSET_MS);
  return `${vietnamTime.getUTCFullYear()}-${String(vietnamTime.getUTCMonth() + 1).padStart(2, "0")}-${String(
    vietnamTime.getUTCDate(),
  ).padStart(2, "0")}T${formatMinutes(vietnamTime.getUTCHours() * 60 + vietnamTime.getUTCMinutes())}:00`;
}

function formatMinutes(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function createEmployeeMap(employees: Employee[]): EmployeeLookupMap {
  const map: EmployeeLookupMap = {
    byCode: new Map<string, Employee>(),
    byTimekeepingCode: new Map<string, Employee>(),
    byName: new Map<string, Employee>(),
  };
  for (const employee of employees) {
    addEmployeeToMap(map, employee);
  }
  return map;
}

function addEmployeeToMap(
  map: EmployeeLookupMap,
  employee: Employee,
) {
  map.byCode.set(normalizeKey(employee.employeeCode), employee);
  const loginStyleCode = toLoginStyleEmployeeCode(employee.employeeCode);
  if (loginStyleCode) {
    map.byCode.set(normalizeKey(loginStyleCode), employee);
  }

  if (employee.timekeepingCode) {
    map.byTimekeepingCode.set(normalizeKey(employee.timekeepingCode), employee);
    const loginStyleTimekeepingCode = toLoginStyleEmployeeCode(employee.timekeepingCode);
    if (loginStyleTimekeepingCode) {
      map.byTimekeepingCode.set(normalizeKey(loginStyleTimekeepingCode), employee);
    }
  }
  map.byName.set(normalizeKey(employee.fullName), employee);
}

function findEmployeeByAttendanceCode(map: EmployeeLookupMap, rawCode: string) {
  const code = normalizeKey(rawCode);
  if (!code) {
    return undefined;
  }

  return map.byTimekeepingCode.get(code) ?? map.byCode.get(code);
}

function toLoginStyleEmployeeCode(value: string) {
  if (/^\d{1,3}$/.test(value.trim())) {
    return `DLE${String(Number(value)).padStart(3, "0")}`;
  }

  const loginCode = value.trim().match(/^DLE0*(\d{1,3})$/i);
  return loginCode ? String(Number(loginCode[1])) : null;
}

function getAttendanceKey(employeeId: string, workDate: string) {
  return `${employeeId}:${workDate}`;
}

function groupUniqueLogsByAttendanceKey(logs: AttendanceLog[]) {
  const grouped = new Map<string, AttendanceLog[]>();

  for (const log of logs) {
    const key = getAttendanceKey(log.employee.id, log.workDate);
    grouped.set(key, [...(grouped.get(key) ?? []), log]);
  }

  return new Map(
    Array.from(grouped.entries())
      .filter(([, rows]) => rows.length === 1)
      .map(([key, rows]) => [key, rows[0] as AttendanceLog]),
  );
}

function getPeriodKey(workDate: string) {
  return workDate.slice(0, 7);
}

function normalizeImportMonth(value?: number) {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || value < 1 || value > 12) {
    throw new HttpError(400, "INVALID_ATTENDANCE_PERIOD", "Tháng chấm công không hợp lệ");
  }

  return value;
}

function normalizeImportYear(value?: number) {
  const year = value ?? getVietnamDateParts().year;
  if (!Number.isInteger(year) || year < 2000) {
    throw new HttpError(400, "INVALID_ATTENDANCE_PERIOD", "Năm chấm công không hợp lệ");
  }

  return year;
}

function buildManualAttendanceValue(rowInput: UpdateAttendanceSummaryRowDto) {
  return [
    rowInput.morningCheckIn,
    rowInput.morningCheckOut,
    rowInput.afternoonCheckIn,
    rowInput.afternoonCheckOut,
    rowInput.nightCheckIn,
    rowInput.nightCheckOut,
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n");
}

function stringCell(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function roundNumber(value: number) {
  return Math.round(value * 100) / 100;
}

function roundCurrency(value: number) {
  return Math.round(value);
}

function filterAttendanceRow<TRecord extends Record<string, unknown>>(
  record: TRecord,
  visibleColumns: AttendanceEmployeeViewColumn[],
) {
  const visibleSet = new Set<string>(visibleColumns);
  const filteredRecord: Record<string, unknown> = {
    id: record.id,
    employeeId: record.employeeId,
  };

  for (const column of attendanceEmployeeViewColumns) {
    if (visibleSet.has(column)) {
      filteredRecord[column] = record[column];
    }
  }

  return filteredRecord;
}

function filterAttendanceTotals<TTotals extends Record<string, unknown>>(
  totals: TTotals,
  visibleColumns: AttendanceEmployeeViewColumn[],
) {
  const visibleSet = new Set<string>(visibleColumns);
  return {
    rows: totals.rows,
    workDay: visibleSet.has("workDay") ? totals.workDay : undefined,
    lateMinutes: visibleSet.has("lateMinutes") ? totals.lateMinutes : undefined,
    earlyLeaveMinutes: visibleSet.has("earlyLeaveMinutes") ? totals.earlyLeaveMinutes : undefined,
    overtimeMinutes: visibleSet.has("overtimeMinutes") ? totals.overtimeMinutes : undefined,
  };
}

function validateSettingsYear(year: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new HttpError(400, "INVALID_ATTENDANCE_SETTINGS_YEAR", "Năm cấu hình không hợp lệ");
  }
}

function getYearRange(year: number) {
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  };
}

function toHolidayDto(holiday: Holiday) {
  return {
    id: holiday.id,
    date: holiday.holidayDate,
    name: holiday.name,
    isPaid: holiday.isPaid,
    amount: Number(holiday.bonusAmount ?? 0),
  };
}

function normalizeHolidaySettings(year: number, dto: AttendanceHolidaySettingsDto) {
  const holidayInputs: Array<{ date: string; name?: string; isPaid?: boolean; amount?: number }> =
    dto.holidays ?? dto.dates?.map((date) => ({ date, isPaid: true, amount: 0 })) ?? [];
  const holidaysByDate = new Map<string, { date: string; name?: string; isPaid: boolean; amount: number }>();

  for (const holiday of holidayInputs) {
    const date = holiday.date.trim();
    if (!isValidDateOnly(date) || !date.startsWith(`${year}-`)) {
      throw new HttpError(400, "INVALID_HOLIDAY_DATE", "Ngày lễ không hợp lệ");
    }

    holidaysByDate.set(date, {
      date,
      name: holiday.name?.trim() || undefined,
      isPaid: holiday.isPaid ?? true,
      amount: roundCurrency(holiday.amount ?? 0),
    });
  }

  return Array.from(holidaysByDate.values()).sort((first, second) => first.date.localeCompare(second.date));
}

function isValidDateOnly(value: string) {
  return isValidVietnamDateOnly(value);
}

function formatDisplayDate(value: string) {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

function normalizeWeeklyDaysOff(value: unknown = DEFAULT_WEEKLY_DAYS_OFF) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : value === undefined || value === null
        ? []
        : [value];
  const days = Array.from(
    new Set(
      rawValues
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6),
    ),
  ).sort((left, right) => left - right);

  return days.length > 0 ? days : [...DEFAULT_WEEKLY_DAYS_OFF];
}

function formatWeeklyDaysOff(value: number[]) {
  return normalizeWeeklyDaysOff(value).join(",");
}

function isWeeklyDayOff(value: string, weeklyDaysOff: Set<number> | number[] = DEFAULT_WEEKLY_DAYS_OFF) {
  const dayOfWeek = getDayOfWeek(value);
  const daysOff = Array.isArray(weeklyDaysOff) ? new Set(weeklyDaysOff) : weeklyDaysOff;
  return daysOff.has(dayOfWeek);
}

function isNonWorkingDate(value: string, calendar: WorkCalendar) {
  return calendar.holidayDates.has(value) || isWeeklyDayOff(value, calendar.weeklyDaysOff);
}

function getDayOfWeek(value: string) {
  return getVietnamDayOfWeek(value);
}

function countStandardWorkDays(month: number, year: number, weeklyDaysOff: number[] = DEFAULT_WEEKLY_DAYS_OFF) {
  const daysInMonth = getDaysInVietnamMonth(month, year);
  let workDays = 0;
  const daysOff = new Set(normalizeWeeklyDaysOff(weeklyDaysOff));

  for (let day = 1; day <= daysInMonth; day += 1) {
    if (!daysOff.has(getVietnamDayOfWeek(formatDate(year, month, day)))) {
      workDays += 1;
    }
  }

  return workDays;
}

function applyParsedAttendance(summary: AttendanceSummary, parsedCell: ParsedAttendanceCell) {
  summary.checkInAt = parsedCell.checkInAt;
  summary.checkOutAt = parsedCell.checkOutAt;
  summary.morningCheckInAt = parsedCell.morningCheckInAt;
  summary.morningCheckOutAt = parsedCell.morningCheckOutAt;
  summary.afternoonCheckInAt = parsedCell.afternoonCheckInAt;
  summary.afternoonCheckOutAt = parsedCell.afternoonCheckOutAt;
  summary.nightCheckInAt = parsedCell.nightCheckInAt;
  summary.nightCheckOutAt = parsedCell.nightCheckOutAt;
  summary.lateMinutes = parsedCell.lateMinutes;
  summary.earlyLeaveMinutes = parsedCell.earlyLeaveMinutes;
  summary.overtimeMinutes = parsedCell.overtimeMinutes;
  summary.workDay = String(parsedCell.workDay);
  summary.status = parsedCell.status;
}
