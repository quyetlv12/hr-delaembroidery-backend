import { existsSync } from "node:fs";

import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
import { Between, In, Not } from "typeorm";

import { HttpError } from "../../common/http-error";
import { formatVietnamTime, getDaysInVietnamMonth, getVietnamDayOfWeek } from "../../common/vietnam-time";
import { AppDataSource } from "../../database/data-source";
import {
  Allowance,
  AttendanceSetting,
  AttendanceSummary,
  Deduction,
  Employee,
  EmployeeMonthlyBonus,
  Holiday,
  PayrollFormulaHistory,
  PayrollFormulaSetting,
  PayrollFormulaTemplate,
  SalaryDetail,
  SalaryEmailLog,
  SalaryPeriod,
  SalaryRecord,
  User,
} from "../../entities";
import {
  payrollEmployeeViewColumns,
  type PayrollEmployeeViewColumn,
} from "../employee-view-settings/employee-view-settings.constants";
import { EmployeeViewSettingsService } from "../employee-view-settings/employee-view-settings.service";
import { EmailSettingsService, type EmailTransportSettings } from "../email-settings/email-settings.service";
import { calculateExcelPayroll, DEFAULT_PAYROLL_FORMULA_SETTING } from "./payroll-formula";
import type {
  PayrollFormulaColumnKey,
  PayrollFormulaSettingDto,
  PayrollFormulaTemplateCreateDto,
  PayrollPeriodDto,
} from "./payroll.dto";

const DEFAULT_OVERTIME_RATE = 1.5;
const DEFAULT_HOLIDAY_RATE = 2;
const DEFAULT_TRANSFER_DEBIT_ACCOUNT = "111003013254";
const DEFAULT_TRANSFER_BANK_CODE = "79321001";
const DEFAULT_WEEKLY_DAYS_OFF = [0];
const MINUTES_PER_WORK_DAY = 8 * 60;
const DEFAULT_FORMULA_SETTING: PayrollFormulaSettingDto = DEFAULT_PAYROLL_FORMULA_SETTING;

type FormulaAuditUser = {
  id?: string;
  loginCode?: string;
};

type PayslipEmailResult = {
  recordId: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  email: string;
  status: "sent" | "failed";
  errorMessage?: string;
};

export class PayrollService {
  private readonly attendanceRepository = AppDataSource.getRepository(AttendanceSummary);
  private readonly attendanceSettingRepository = AppDataSource.getRepository(AttendanceSetting);
  private readonly employeeRepository = AppDataSource.getRepository(Employee);
  private readonly holidayRepository = AppDataSource.getRepository(Holiday);
  private readonly allowanceRepository = AppDataSource.getRepository(Allowance);
  private readonly deductionRepository = AppDataSource.getRepository(Deduction);
  private readonly periodRepository = AppDataSource.getRepository(SalaryPeriod);
  private readonly recordRepository = AppDataSource.getRepository(SalaryRecord);
  private readonly detailRepository = AppDataSource.getRepository(SalaryDetail);
  private readonly emailLogRepository = AppDataSource.getRepository(SalaryEmailLog);
  private readonly monthlyBonusRepository = AppDataSource.getRepository(EmployeeMonthlyBonus);
  private readonly formulaSettingRepository = AppDataSource.getRepository(PayrollFormulaSetting);
  private readonly formulaHistoryRepository = AppDataSource.getRepository(PayrollFormulaHistory);
  private readonly formulaTemplateRepository = AppDataSource.getRepository(PayrollFormulaTemplate);
  private readonly employeeViewSettingsService = new EmployeeViewSettingsService();
  private readonly emailSettingsService = new EmailSettingsService();

  async list(dto: PayrollPeriodDto, employeeId?: string) {
    const period = await this.findPeriod(dto.month, dto.year);
    if (!period) {
      return {
        period: null,
        records: [],
        totals: this.emptyTotals(),
      };
    }

    const records = await this.findRecords(period.id, employeeId);
    const visibleColumns = employeeId
      ? (await this.employeeViewSettingsService.getSettings()).payrollColumns
      : [...payrollEmployeeViewColumns];
    const recordDtos = records.map((record) => this.toRecordDto(record));
    const totals = this.getTotals(records);

    return {
      period: this.toPeriodDto(period),
      records: employeeId ? recordDtos.map((record) => filterPayrollRecord(record, visibleColumns)) : recordDtos,
      totals: employeeId ? filterPayrollTotals(totals, visibleColumns) : totals,
      visibleColumns,
    };
  }

  async calculatePeriod(dto: PayrollPeriodDto) {
    const period = await this.getOrCreatePeriod(dto.month, dto.year);
    if (period.status === "locked") {
      throw new HttpError(400, "PAYROLL_LOCKED", "Kỳ lương đã bị khóa");
    }

    const dateRange = getMonthRange(dto.month, dto.year);
    const [summaries, employees, allowances, deductions, holidays, attendanceSettings] = await Promise.all([
      this.attendanceRepository.find({
        where: { workDate: Between(dateRange.from, dateRange.to) },
        relations: { employee: true },
      }),
      this.employeeRepository.find({ where: { status: "active" } }),
      this.allowanceRepository.find({ where: { isActive: true }, relations: { employee: true } }),
      this.deductionRepository.find({ where: { isActive: true }, relations: { employee: true } }),
      this.holidayRepository.find({ where: { holidayDate: Between(dateRange.from, dateRange.to) } }),
      this.attendanceSettingRepository.findOne({ where: {}, order: { createdAt: "ASC" } }),
    ]);

    const summariesByEmployee = groupByEmployee(summaries);
    const monthSetting = await this.getPayrollMonthSetting(dto.month, dto.year);
    const standardWorkDay = monthSetting.standardWorkDay;
    const holidaysByDate = new Map(holidays.map((holiday) => [holiday.holidayDate, holiday]));
    const holidayRate = Number(attendanceSettings?.holidayRate ?? DEFAULT_HOLIDAY_RATE);
    const overtimeRate = Number(attendanceSettings?.overtimeRate ?? DEFAULT_OVERTIME_RATE);
    const formulaSetting = dto.formulaSetting
      ? normalizeFormulaSettingSnapshot(dto.formulaSetting)
      : await this.getFormulaSetting();

    for (const employee of employees.filter((item) => summariesByEmployee.has(item.id))) {
      const employeeSummaries = summariesByEmployee.get(employee.id) ?? [];
      const employeeAllowances = allowances.filter((allowance) => allowance.employee.id === employee.id);
      const employeeDeductions = deductions.filter((deduction) => deduction.employee.id === employee.id);
      await this.upsertRecord({
        employee,
        period,
        summaries: employeeSummaries,
        allowances: employeeAllowances,
        deductions: employeeDeductions,
        standardWorkDay,
        holidaysByDate,
        holidayRate,
        overtimeRate,
        formulaSetting,
      });
    }

    return this.list(dto);
  }

  async restoreMonthlyBonuses(dto: PayrollPeriodDto) {
    const period = await this.getOrCreatePeriod(dto.month, dto.year);
    if (period.status === "locked") {
      throw new HttpError(400, "PAYROLL_LOCKED", "Kỳ lương đã bị khóa");
    }

    const bonuses = await this.monthlyBonusRepository.find({
      where: { month: dto.month, year: dto.year },
      relations: { employee: true },
    });
    const activeBonuses = bonuses.filter((bonus) => Number(bonus.amount) !== 0);
    const records = await this.recordRepository.find({
      where: { salaryPeriod: { id: period.id } },
      relations: { employee: true, salaryPeriod: true },
    });

    if (records.length === 0) {
      if (activeBonuses.length > 0) {
        await this.createBonusOnlyRecords(period, activeBonuses);
        return this.list(dto);
      }

      return this.calculatePeriod(dto);
    }

    const bonusByEmployee = new Map(bonuses.map((bonus) => [bonus.employee.id, Number(bonus.amount)]));
    const existingEmployeeIds = new Set(records.map((record) => record.employee.id));
    const missingBonusRecords = activeBonuses.filter((bonus) => !existingEmployeeIds.has(bonus.employee.id));
    if (missingBonusRecords.length > 0) {
      await this.createBonusOnlyRecords(period, missingBonusRecords);
    }

    const changedRecords = records.flatMap((record) => {
      if (record.status === "locked") {
        throw new HttpError(400, "PAYROLL_LOCKED", "Kỳ lương đã bị khóa");
      }

      const restoredBonus = bonusByEmployee.get(record.employee.id);
      if (restoredBonus === undefined || Number(record.bonus) === restoredBonus) {
        return [];
      }

      record.bonus = String(restoredBonus);
      record.netSalary = String(
        roundCurrency(Math.max(0, Number(record.grossSalary) - Number(record.deductionTotal) + restoredBonus)),
      );
      return [record];
    });

    if (changedRecords.length > 0) {
      await this.recordRepository.save(changedRecords);
    }

    return this.list(dto);
  }

  async getFormulaSetting() {
    const setting = await this.formulaSettingRepository.findOne({
      where: {},
      order: { createdAt: "ASC" },
    });

    return setting ? this.toFormulaSettingDto(setting) : DEFAULT_FORMULA_SETTING;
  }

  async updateFormulaSetting(dto: PayrollFormulaSettingDto, user?: FormulaAuditUser) {
    const savedSetting = await this.saveFormulaSettingSnapshot(dto, {
      action: "update",
      note: "Cập nhật công thức",
      user,
    });
    await this.recalculateUnlockedPeriods();
    return savedSetting;
  }

  async listFormulaHistory() {
    const histories = await this.formulaHistoryRepository.find({
      order: { createdAt: "DESC" },
      take: 30,
    });

    return histories.map((history) => ({
      id: history.id,
      action: history.action,
      changeNote: history.changeNote ?? undefined,
      changedByLoginCode: history.changedByLoginCode ?? undefined,
      createdAt: history.createdAt,
      setting: normalizeFormulaSettingSnapshot(history.snapshot),
    }));
  }

  async revertFormulaHistory(id: string, user?: FormulaAuditUser) {
    const history = await this.formulaHistoryRepository.findOne({ where: { id } });
    if (!history) {
      throw new HttpError(404, "PAYROLL_FORMULA_HISTORY_NOT_FOUND", "Không tìm thấy lịch sử công thức");
    }

    const savedSetting = await this.saveFormulaSettingSnapshot(history.snapshot, {
      action: "revert",
      note: `Khôi phục từ phiên bản ${formatDateTime(history.createdAt)}`,
      user,
    });
    await this.recalculateUnlockedPeriods();
    return savedSetting;
  }

  async listFormulaTemplates() {
    const templates = await this.formulaTemplateRepository.find({
      order: { createdAt: "DESC" },
    });

    return templates.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description ?? undefined,
      createdByLoginCode: template.createdByLoginCode ?? undefined,
      createdAt: template.createdAt,
      setting: normalizeFormulaSettingSnapshot(template.snapshot),
    }));
  }

  async createFormulaTemplate(dto: PayrollFormulaTemplateCreateDto, user?: FormulaAuditUser) {
    const template = await this.formulaTemplateRepository.save(
      this.formulaTemplateRepository.create({
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        createdByUserId: user?.id ?? null,
        createdByLoginCode: user?.loginCode ?? null,
        snapshot: normalizeFormulaSettingSnapshot(dto.setting),
      }),
    );

    return {
      id: template.id,
      name: template.name,
      description: template.description ?? undefined,
      createdByLoginCode: template.createdByLoginCode ?? undefined,
      createdAt: template.createdAt,
      setting: normalizeFormulaSettingSnapshot(template.snapshot),
    };
  }

  async applyFormulaTemplate(id: string, user?: FormulaAuditUser) {
    const template = await this.formulaTemplateRepository.findOne({ where: { id } });
    if (!template) {
      throw new HttpError(404, "PAYROLL_FORMULA_TEMPLATE_NOT_FOUND", "Không tìm thấy mẫu công thức");
    }

    const savedSetting = await this.saveFormulaSettingSnapshot(template.snapshot, {
      action: "template",
      note: `Áp dụng mẫu ${template.name}`,
      user,
    });
    await this.recalculateUnlockedPeriods();
    return savedSetting;
  }

  private async saveFormulaSettingSnapshot(
    dto: unknown,
    audit: { action: string; note: string; user?: FormulaAuditUser },
  ) {
    const existing = await this.formulaSettingRepository.findOne({
      where: {},
      order: { createdAt: "ASC" },
    });
    const setting = existing ?? this.formulaSettingRepository.create();
    const previousSnapshot = existing ? this.toFormulaSettingDto(existing) : DEFAULT_FORMULA_SETTING;
    const snapshot = normalizeFormulaSettingSnapshot(dto);
    this.formulaSettingRepository.merge(setting, {
      insuranceBaseSalary: String(snapshot.insuranceBaseSalary),
      employeeInsuranceRate: String(snapshot.employeeInsuranceRate),
      employerInsuranceRate: String(snapshot.employerInsuranceRate),
      defaultMealAllowance: String(snapshot.defaultMealAllowance),
      defaultPhoneAllowance: String(snapshot.defaultPhoneAllowance),
      columnFormulas: snapshot.columnFormulas,
      dailySalaryFormula: existing?.dailySalaryFormula ?? getDefaultFormula("dailyTotal"),
      grossSalaryFormula: existing?.grossSalaryFormula ?? getDefaultFormula("grossSalary"),
      deductionFormula: existing?.deductionFormula ?? getDefaultFormula("deductionTotal"),
      netSalaryFormula: existing?.netSalaryFormula ?? getDefaultFormula("netSalary"),
    });

    const savedSetting = await this.formulaSettingRepository.save(setting);
    await this.formulaHistoryRepository.save(
      this.formulaHistoryRepository.create({
        action: audit.action,
        changeNote: `Trước khi ${audit.note.toLocaleLowerCase("vi-VN")}`,
        changedByUserId: audit.user?.id ?? null,
        changedByLoginCode: audit.user?.loginCode ?? null,
        snapshot: previousSnapshot,
      }),
    );
    return this.toFormulaSettingDto(savedSetting);
  }

  private async recalculateUnlockedPeriods() {
    const periods = await this.periodRepository.find({
      where: { status: Not("locked") },
      order: { year: "ASC", month: "ASC" },
    });

    for (const period of periods) {
      await this.calculatePeriod({ month: period.month, year: period.year });
    }
  }

  async recalculateUnlockedPeriodsForEmployee(employeeId: string) {
    const summaries = await this.attendanceRepository.find({
      where: { employee: { id: employeeId } },
    });
    const periodKeys = Array.from(new Set(summaries.map((summary) => summary.workDate.slice(0, 7))));

    for (const periodKey of periodKeys) {
      const [year, month] = periodKey.split("-").map(Number);
      if (!Number.isFinite(month) || !Number.isFinite(year)) {
        continue;
      }

      const period = await this.findPeriod(month, year);
      if (period?.status === "locked") {
        continue;
      }

      await this.calculatePeriod({ month, year });
    }
  }

  async recalculatePeriodIfUnlocked(month: number, year: number) {
    const period = await this.findPeriod(month, year);
    if (!period || period.status === "locked") {
      return;
    }

    await this.calculatePeriod({ month, year });
  }

  async lockPeriod(id: string) {
    const period = await this.periodRepository.findOne({ where: { id } });
    if (!period) {
      throw new HttpError(404, "SALARY_PERIOD_NOT_FOUND", "Không tìm thấy kỳ lương");
    }

    period.status = "locked";
    period.lockedAt = new Date();
    await this.periodRepository.save(period);
    await this.recordRepository
      .createQueryBuilder()
      .update(SalaryRecord)
      .set({ status: "locked" })
      .where("salaryPeriodId = :periodId", { periodId: id })
      .execute();

    return this.list({ month: period.month, year: period.year });
  }

  async unlockPeriod(id: string) {
    const period = await this.periodRepository.findOne({ where: { id } });
    if (!period) {
      throw new HttpError(404, "SALARY_PERIOD_NOT_FOUND", "Không tìm thấy kỳ lương");
    }

    period.status = "draft";
    period.lockedAt = null;
    await this.periodRepository.save(period);
    await this.recordRepository
      .createQueryBuilder()
      .update(SalaryRecord)
      .set({ status: "draft" })
      .where("salaryPeriodId = :periodId", { periodId: id })
      .execute();

    return this.list({ month: period.month, year: period.year });
  }

  async exportTransferFile(periodId: string) {
    const period = await this.periodRepository.findOne({ where: { id: periodId } });
    if (!period) {
      throw new HttpError(404, "SALARY_PERIOD_NOT_FOUND", "Không tìm thấy kỳ lương");
    }

    const records = await this.recordRepository.find({
      where: { salaryPeriod: { id: periodId } },
      relations: {
        employee: {
          bankAccounts: true,
        },
        salaryPeriod: true,
      },
      order: {
        employee: {
          employeeCode: "ASC",
        },
      },
    });

    if (records.length === 0) {
      throw new HttpError(422, "PAYROLL_RECORDS_EMPTY", "Kỳ lương chưa có dữ liệu để xuất file chuyển tiền");
    }

    records.sort((firstRecord, secondRecord) =>
      firstRecord.employee.employeeCode.localeCompare(secondRecord.employee.employeeCode, "vi-VN", { numeric: true }),
    );

    const missingBankEmployees = records
      .filter((record) => {
        const bankAccount = getPrimaryBankAccount(record.employee.bankAccounts);
        return !bankAccount?.accountNumber?.trim() || !bankAccount.bankName?.trim();
      })
      .map((record) => `${record.employee.employeeCode} - ${record.employee.fullName}`);

    if (missingBankEmployees.length > 0) {
      throw new HttpError(
        422,
        "EMPLOYEE_BANK_ACCOUNT_REQUIRED",
        `Vui lòng bổ sung tài khoản ngân hàng cho: ${missingBankEmployees.join(", ")}`,
      );
    }

    const rows = records.map((record, index) => {
      const bankAccount = getPrimaryBankAccount(record.employee.bankAccounts);
      return [
        index + 1,
        DEFAULT_TRANSFER_DEBIT_ACCOUNT,
        formatTransferAmount(Number(record.netSalary)),
        bankAccount?.accountNumber.trim() ?? "",
        normalizeTransferText(bankAccount?.accountHolder || record.employee.fullName),
        normalizeBankCode(bankAccount?.bankName ?? ""),
        `Tien Luong Thang ${period.month}/${period.year}`,
        "",
        "",
        "",
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([
      ["DANH SÁCH ĐIỆN CHUYỂN TIỀN TRONG NƯỚC/ DOMESTIC TRANSFERS", "", "", "", "", "", "", "", "", ""],
      ["", "Tra cứu mã Ngân hàng\nSearch Bankcode:", "", "", "", "", "", "", "", ""],
      ["", "", "", "", "", DEFAULT_TRANSFER_BANK_CODE, "", "", "", records.length],
      [
        "STT",
        "TK chuyển/\nDebit account\n(*)",
        " Số  tiền chuyển/\n Amount\n(*) ",
        "",
        "Tên người hưởng/\nBeneficiary Name\n(*)",
        "Tên chi nhánh Ngân hàng thụ hưởng/\nBeneficiary Bank\n(*)",
        "Nội dung/\nReference\n(*)",
        "Mã người thụ hưởng/\nBeneficiary No",
        "Số chứng từ/ Ref No",
        "Ngày thanh toán/ Effective date",
      ],
      ...rows,
    ]);
    worksheet["!merges"] = [{ s: { c: 0, r: 0 }, e: { c: 9, r: 0 } }];
    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 },
      { wch: 32 },
      { wch: 26 },
      { wch: 26 },
      { wch: 20 },
      { wch: 18 },
      { wch: 20 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Danh sach");
    XLSX.utils.book_append_sheet(workbook, this.createTransferInfoSheet(records), "Info");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xls" }) as Buffer;
    return {
      buffer,
      fileName: `chuyen_tien_luong_T${period.month}${period.year}.xls`,
      contentType: "application/vnd.ms-excel",
    };
  }

  async sendPayslipEmails(periodId: string, recordIds: string[], user?: FormulaAuditUser) {
    const period = await this.periodRepository.findOne({ where: { id: periodId } });
    if (!period) {
      throw new HttpError(404, "SALARY_PERIOD_NOT_FOUND", "Không tìm thấy kỳ lương");
    }

    const uniqueRecordIds = Array.from(new Set(recordIds));
    const records = await this.recordRepository.find({
      where: {
        id: In(uniqueRecordIds),
        salaryPeriod: { id: periodId },
      },
      relations: {
        employee: {
          department: true,
          position: true,
        },
        details: true,
        salaryPeriod: true,
      },
      order: {
        employee: {
          employeeCode: "ASC",
        },
      },
    });

    if (records.length === 0) {
      throw new HttpError(422, "PAYROLL_RECORDS_EMPTY", "Không có dòng lương nào để gửi phiếu lương");
    }
    if (records.length !== uniqueRecordIds.length) {
      throw new HttpError(422, "PAYROLL_RECORDS_MISMATCH", "Một số dòng lương không thuộc kỳ đang chọn");
    }

    const mailSettings = await this.emailSettingsService.resolveEffectiveSettings();
    const transporter = createMailTransporter(mailSettings);
    const results: PayslipEmailResult[] = [];

    for (const record of records) {
      const email = record.employee.email?.trim() ?? "";
      const baseResult = {
        recordId: record.id,
        employeeId: record.employee.id,
        employeeCode: record.employee.employeeCode,
        employeeName: record.employee.fullName,
        email,
      };

      if (!email) {
        const errorMessage = "Nhân viên chưa có email";
        await this.savePayslipEmailLog(record, email, "failed", errorMessage, user);
        results.push({ ...baseResult, status: "failed", errorMessage });
        continue;
      }

      try {
        const attendanceRows = await this.getPayslipAttendanceRows(record);
        const pdfBuffer = await createPayslipPdf(record, attendanceRows);
        await transporter.sendMail({
          from: mailSettings.mailFrom,
          to: email,
          subject: `Phiếu lương tháng ${String(period.month).padStart(2, "0")}/${period.year}`,
          text: `Chào ${record.employee.fullName},\n\nHR gửi bạn phiếu lương tháng ${String(period.month).padStart(2, "0")}/${period.year} trong file PDF đính kèm.\n\nTrân trọng.`,
          attachments: [
            {
              filename: `phieu-luong-${record.employee.employeeCode}-${String(period.month).padStart(2, "0")}-${period.year}.pdf`,
              content: pdfBuffer,
              contentType: "application/pdf",
            },
          ],
        });
        await this.savePayslipEmailLog(record, email, "sent", null, user);
        results.push({ ...baseResult, status: "sent" });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Gửi email thất bại";
        await this.savePayslipEmailLog(record, email, "failed", errorMessage, user);
        results.push({ ...baseResult, status: "failed", errorMessage });
      }
    }

    return {
      total: results.length,
      sent: results.filter((result) => result.status === "sent").length,
      failed: results.filter((result) => result.status === "failed").length,
      results,
    };
  }

  async sendPayslipTestEmail(recordId: string, email: string) {
    const record = await this.recordRepository.findOne({
      where: { id: recordId },
      relations: {
        employee: {
          department: true,
          position: true,
        },
        details: true,
        salaryPeriod: true,
      },
    });

    if (!record) {
      throw new HttpError(404, "SALARY_RECORD_NOT_FOUND", "Không tìm thấy dòng bảng lương");
    }

    const mailSettings = await this.emailSettingsService.resolveEffectiveSettings();
    const transporter = createMailTransporter(mailSettings);
    let pdfBuffer: Buffer;
    try {
      const attendanceRows = await this.getPayslipAttendanceRows(record);
      pdfBuffer = await createPayslipPdf(record, attendanceRows);
    } catch (error) {
      throw new HttpError(500, "PAYSLIP_PDF_GENERATION_FAILED", "Không tạo được file PDF phiếu lương để gửi test", {
        reason: getErrorMessage(error),
      });
    }

    const periodText = `${String(record.salaryPeriod.month).padStart(2, "0")}/${record.salaryPeriod.year}`;
    let info: Awaited<ReturnType<typeof transporter.sendMail>>;
    try {
      info = await transporter.sendMail({
        from: mailSettings.mailFrom,
        to: email,
        subject: `[Test] Phiếu lương tháng ${periodText} - ${record.employee.fullName}`,
        text: [
          `Đây là email test phiếu lương tháng ${periodText}.`,
          `Nhân viên trên phiếu lương: ${record.employee.fullName} (${record.employee.employeeCode}).`,
          "",
          "Email này được gửi tới địa chỉ test do admin nhập, không gửi tới email nhân viên.",
        ].join("\n"),
        attachments: [
          {
            filename: `test-phieu-luong-${record.employee.employeeCode}-${String(record.salaryPeriod.month).padStart(2, "0")}-${record.salaryPeriod.year}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });
    } catch (error) {
      throw new HttpError(502, "PAYSLIP_TEST_EMAIL_FAILED", "Không gửi được email test phiếu lương", {
        reason: getErrorMessage(error),
      });
    }

    return {
      recordId: record.id,
      employeeId: record.employee.id,
      employeeCode: record.employee.employeeCode,
      employeeName: record.employee.fullName,
      originalEmployeeEmail: record.employee.email?.trim() ?? "",
      email,
      messageId: info.messageId,
      sentAt: new Date().toISOString(),
    };
  }

  private async savePayslipEmailLog(
    record: SalaryRecord,
    email: string,
    status: "sent" | "failed",
    errorMessage: string | null,
    user?: FormulaAuditUser,
  ) {
    await this.emailLogRepository.save(
      this.emailLogRepository.create({
        employee: record.employee,
        salaryPeriod: record.salaryPeriod,
        salaryRecord: record,
        email,
        status,
        sentAt: status === "sent" ? new Date() : null,
        errorMessage,
        sentBy: user?.id ? ({ id: user.id } as User) : null,
      }),
    );
  }

  private async getPayslipAttendanceRows(record: SalaryRecord) {
    const dateRange = getMonthRange(record.salaryPeriod.month, record.salaryPeriod.year);
    return this.attendanceRepository.find({
      where: {
        employee: { id: record.employee.id },
        workDate: Between(dateRange.from, dateRange.to),
      },
      order: { workDate: "ASC" },
    });
  }

  private async upsertRecord(input: {
    employee: Employee;
    period: SalaryPeriod;
    summaries: AttendanceSummary[];
    allowances: Allowance[];
    deductions: Deduction[];
    standardWorkDay: number;
    holidaysByDate: Map<string, Holiday>;
    holidayRate: number;
    overtimeRate: number;
    formulaSetting: PayrollFormulaSettingDto;
  }) {
    const holidayWorkStats = getEmployeeHolidayWorkStats(input.summaries, input.holidaysByDate);
    const regularSummaries = input.summaries.filter((summary) => !input.holidaysByDate.has(summary.workDate));
    const attendanceWorkDay = sum(regularSummaries.map((summary) => Number(summary.workDay)));
    const workDay = roundNumber(attendanceWorkDay);
    const overtimeMinutes = sum(regularSummaries.map((summary) => summary.overtimeMinutes));
    const existingRecord = await this.recordRepository.findOne({
      where: {
        employee: { id: input.employee.id },
        salaryPeriod: { id: input.period.id },
      },
      relations: { employee: true, salaryPeriod: true },
    });
    const monthlyBonus = await this.monthlyBonusRepository.findOne({
      where: {
        employee: { id: input.employee.id },
        month: input.period.month,
        year: input.period.year,
      },
    });
    const manualBonus = Number(monthlyBonus?.amount ?? existingRecord?.bonus ?? 0);
    const payrollFormula = calculateExcelPayroll({
      actualSalary: Number(input.employee.baseSalary),
      workDay,
      standardWorkDay: input.standardWorkDay,
      overtimeMinutes,
      overtimeRate: input.overtimeRate,
      holidayWorkDay: holidayWorkStats.workDay,
      holidayRate: input.holidayRate,
      holidayFixedBonusTotal: holidayWorkStats.fixedBonusTotal,
      insuranceSalary: input.formulaSetting.insuranceBaseSalary,
      employeeInsuranceRate: input.formulaSetting.employeeInsuranceRate,
      employerInsuranceRate: input.formulaSetting.employerInsuranceRate,
      defaultMealAllowance: input.formulaSetting.defaultMealAllowance,
      defaultPhoneAllowance: input.formulaSetting.defaultPhoneAllowance,
      monthlyBonus: manualBonus,
      formulas: {
        columnFormulas: input.formulaSetting.columnFormulas,
      },
      allowances: input.allowances,
      deductions: input.deductions,
    });

    const record = existingRecord ?? this.recordRepository.create();

    this.recordRepository.merge(record, {
      employee: input.employee,
      salaryPeriod: input.period,
      baseSalary: String(payrollFormula.earnedSalary),
      configuredSalary: String(payrollFormula.actualSalary),
      insuranceSalary: String(payrollFormula.insuranceSalary),
      workDay: String(payrollFormula.workDay),
      standardWorkDay: String(payrollFormula.standardWorkDay),
      fixedDailySalary: String(payrollFormula.fixedDailySalary),
      responsibilityAllowance: String(payrollFormula.responsibilityAllowance),
      mealAllowance: String(payrollFormula.mealAllowance),
      phoneAllowance: String(payrollFormula.phoneAllowance),
      kpiAllowance: String(payrollFormula.kpiAllowance),
      dailyTotal: String(payrollFormula.dailyTotal),
      overtimeWorkDay: String(payrollFormula.overtimeWorkDay),
      totalWorkDay: String(payrollFormula.totalWorkDay),
      allowanceTotal: String(payrollFormula.allowanceTotal),
      bonusTotal: String(payrollFormula.bonusTotal),
      bonus: String(payrollFormula.bonus),
      overtimeTotal: String(payrollFormula.overtimeSalary),
      grossSalary: String(payrollFormula.grossSalary),
      employerInsuranceTotal: String(payrollFormula.employerInsuranceTotal),
      insuranceTotal: String(payrollFormula.employeeInsuranceDeduction),
      totalInsurance: String(payrollFormula.totalInsurance),
      taxTotal: String(payrollFormula.personalIncomeTax),
      advanceTotal: String(payrollFormula.advanceTotal),
      deductionTotal: String(payrollFormula.totalDeduction),
      netSalary: String(payrollFormula.netSalary),
      status: input.period.status,
    });

    const savedRecord = await this.recordRepository.save(record);
    await this.detailRepository
      .createQueryBuilder()
      .delete()
      .from(SalaryDetail)
      .where("salaryRecordId = :recordId", { recordId: savedRecord.id })
      .execute();
    await this.detailRepository.save(
      [
        {
          type: "base",
          label: `Lương trong tháng = Tổng lương ngày x ${payrollFormula.workDay}/${payrollFormula.standardWorkDay} ngày công`,
          amount: payrollFormula.earnedSalary,
        },
        {
          type: "base",
          label: `Ngày lễ đi làm: ${holidayWorkStats.workDay} công x hệ số ${formatMultiplier(input.holidayRate)}`,
          amount: 0,
        },
        {
          type: "overtime",
          label: `${roundNumber(overtimeMinutes / 60)} giờ tăng ca x hệ số ${input.overtimeRate}`,
          amount: payrollFormula.overtimeSalary,
        },
        {
          type: "gross",
          label: "Tổng lương = Lương trong tháng + Lương làm thêm giờ + Lương ngày lễ",
          amount: payrollFormula.grossSalary,
        },
        ...payrollFormula.formulaDetails.map((detail) => ({
          type: "formula",
          label: `${detail.name} = ${detail.formula}`,
          amount: isDeductionFormulaKey(detail.key) ? -detail.amount : detail.amount,
        })),
        {
          type: "insurance",
          label: `BHXH NLĐ ${formatPercent(input.formulaSetting.employeeInsuranceRate)}`,
          amount: -payrollFormula.employeeInsuranceDeduction,
        },
        { type: "tax", label: "Thuế thu nhập cá nhân", amount: -payrollFormula.personalIncomeTax },
        { type: "deduction", label: "Tạm ứng / khấu trừ khác", amount: -payrollFormula.advanceTotal },
        { type: "deduction", label: "Tổng cộng các khoản giảm trừ", amount: -payrollFormula.totalDeduction },
        { type: "bonus", label: `Lương ngày lễ ${holidayWorkStats.workDay} công`, amount: payrollFormula.bonusTotal },
      ].map((detail) =>
        this.detailRepository.create({
          salaryRecord: savedRecord,
          type: detail.type,
          label: detail.label,
          amount: String(detail.amount),
        }),
      ),
    );
	  }

  private async createBonusOnlyRecords(period: SalaryPeriod, bonuses: EmployeeMonthlyBonus[]) {
    if (bonuses.length === 0) {
      return;
    }

    const [monthSetting, formulaSetting] = await Promise.all([
      this.getPayrollMonthSetting(period.month, period.year),
      this.getFormulaSetting(),
    ]);
    const standardWorkDay = monthSetting.standardWorkDay;
    const insuranceSalary = Number(formulaSetting.insuranceBaseSalary);
    const fixedDailySalary = standardWorkDay > 0 ? roundCurrency(insuranceSalary / standardWorkDay) : 0;
    const records = bonuses.map((bonus) => {
      const amount = roundCurrency(Number(bonus.amount));
      return this.recordRepository.create({
        employee: bonus.employee,
        salaryPeriod: period,
        baseSalary: "0",
        configuredSalary: String(Number(bonus.employee.baseSalary ?? 0)),
        insuranceSalary: String(insuranceSalary),
        workDay: "0",
        standardWorkDay: String(standardWorkDay),
        fixedDailySalary: String(fixedDailySalary),
        responsibilityAllowance: "0",
        mealAllowance: "0",
        phoneAllowance: "0",
        kpiAllowance: "0",
        dailyTotal: String(fixedDailySalary),
        overtimeWorkDay: "0",
        totalWorkDay: "0",
        allowanceTotal: "0",
        bonusTotal: "0",
        bonus: String(amount),
        overtimeTotal: "0",
        grossSalary: "0",
        employerInsuranceTotal: "0",
        insuranceTotal: "0",
        totalInsurance: "0",
        taxTotal: "0",
        advanceTotal: "0",
        deductionTotal: "0",
        netSalary: String(amount),
        status: period.status,
      });
    });

    const savedRecords = await this.recordRepository.save(records);
    await this.detailRepository.save(
      savedRecords.map((record) =>
        this.detailRepository.create({
          salaryRecord: record,
          type: "bonus",
          label: `Thưởng tháng ${String(period.month).padStart(2, "0")}/${period.year}`,
          amount: record.bonus,
        }),
      ),
    );
  }

  private async getOrCreatePeriod(month: number, year: number) {
    const existingPeriod = await this.findPeriod(month, year);
    if (existingPeriod) {
      return existingPeriod;
    }

    return this.periodRepository.save(
      this.periodRepository.create({
        month,
        year,
        status: "draft",
      }),
    );
  }

  private findPeriod(month: number, year: number) {
    return this.periodRepository.findOne({
      where: { month, year },
    });
  }

  private findRecords(periodId: string, employeeId?: string) {
    return this.recordRepository.find({
      where: employeeId
        ? { salaryPeriod: { id: periodId }, employee: { id: employeeId } }
        : { salaryPeriod: { id: periodId } },
      relations: {
        employee: {
          department: true,
          position: true,
        },
        details: true,
        salaryPeriod: true,
      },
      order: {
        employee: {
          employeeCode: "ASC",
        },
      },
    });
  }

  private toPeriodDto(period: SalaryPeriod) {
    return {
      id: period.id,
      month: period.month,
      year: period.year,
      status: period.status,
      lockedAt: period.lockedAt ?? undefined,
    };
  }

  private toRecordDto(record: SalaryRecord) {
    const workDay = Number(record.workDay);
    const standardWorkDay = Number(record.standardWorkDay);
    const earnedSalary = Number(record.baseSalary);
    const storedConfiguredSalary = Number(record.configuredSalary);
    const configuredSalary = storedConfiguredSalary > 0 ? storedConfiguredSalary : Number(record.employee.baseSalary || 0);
    const storedInsuranceSalary = Number(record.insuranceSalary);
    const insuranceSalary =
      storedInsuranceSalary > 0 ? storedInsuranceSalary : configuredSalary > 0 ? DEFAULT_FORMULA_SETTING.insuranceBaseSalary : 0;
    const storedFixedDailySalary = Number(record.fixedDailySalary);
    const fixedDailySalary =
      storedFixedDailySalary > 0 ? storedFixedDailySalary : standardWorkDay > 0 ? insuranceSalary / standardWorkDay : 0;
    const storedDailyTotal = Number(record.dailyTotal);
    const dailyTotal = storedDailyTotal > 0 ? storedDailyTotal : workDay > 0 ? earnedSalary / workDay : 0;
    const storedKpiAllowance = Number(record.kpiAllowance);
    const kpiAllowance = storedKpiAllowance > 0 ? storedKpiAllowance : Math.max(0, dailyTotal - fixedDailySalary);
    const overtimeWorkDay = Number(record.overtimeWorkDay);
    const totalWorkDay = Number(record.totalWorkDay) || roundNumber(workDay + overtimeWorkDay);
    const grossSalary = Number(record.grossSalary) || earnedSalary + Number(record.overtimeTotal);
    const employerInsuranceTotal = Number(record.employerInsuranceTotal) || roundCurrency(insuranceSalary * 0.215);
    const totalInsurance = Number(record.totalInsurance) || employerInsuranceTotal + Number(record.insuranceTotal);

    return {
      id: record.id,
      employeeId: record.employee.id,
      employeeCode: record.employee.employeeCode,
      employeeName: record.employee.fullName,
      departmentName: record.employee.department?.name ?? "",
      positionName: record.employee.position?.name ?? "",
      email: record.employee.email,
      configuredSalary,
      insuranceSalary,
      workDay,
      standardWorkDay,
      fixedDailySalary,
      responsibilityAllowance: Number(record.responsibilityAllowance),
      mealAllowance: Number(record.mealAllowance),
      phoneAllowance: Number(record.phoneAllowance),
      kpiAllowance,
      dailyTotal,
      overtimeWorkDay,
      totalWorkDay,
      baseSalary: earnedSalary,
      earnedSalary,
      allowanceTotal: Number(record.allowanceTotal),
      bonusTotal: Number(record.bonusTotal),
      bonus: Number(record.bonus),
      overtimeTotal: Number(record.overtimeTotal),
      grossSalary,
      employerInsuranceTotal,
      insuranceTotal: Number(record.insuranceTotal),
      totalInsurance,
      taxTotal: Number(record.taxTotal),
      advanceTotal: Number(record.advanceTotal),
      deductionTotal: Number(record.deductionTotal),
      netSalary: Number(record.netSalary),
      dependentNote: getDependentNote(record),
      status: record.status,
      details: record.details?.map((detail) => ({
        id: detail.id,
        type: detail.type,
        label: detail.label,
        amount: Number(detail.amount),
      })) ?? [],
    };
  }

  private toFormulaSettingDto(setting: PayrollFormulaSetting): PayrollFormulaSettingDto {
    return {
      insuranceBaseSalary: Number(setting.insuranceBaseSalary),
      employeeInsuranceRate: Number(setting.employeeInsuranceRate),
      employerInsuranceRate: Number(setting.employerInsuranceRate),
      defaultMealAllowance: Number(setting.defaultMealAllowance ?? DEFAULT_FORMULA_SETTING.defaultMealAllowance),
      defaultPhoneAllowance: Number(setting.defaultPhoneAllowance ?? DEFAULT_FORMULA_SETTING.defaultPhoneAllowance),
      columnFormulas: normalizeColumnFormulaList(setting.columnFormulas ?? getLegacyColumnFormulas(setting)),
    };
  }

  private getTotals(records: SalaryRecord[]) {
    return {
      employeeCount: records.length,
      workDay: roundNumber(sum(records.map((record) => Number(record.workDay)))),
      overtimeTotal: roundCurrency(sum(records.map((record) => Number(record.overtimeTotal)))),
      netSalary: roundCurrency(sum(records.map((record) => Number(record.netSalary)))),
    };
  }

  private emptyTotals() {
    return {
      employeeCount: 0,
      workDay: 0,
      overtimeTotal: 0,
      netSalary: 0,
    };
  }

  private async getWeeklyDaysOff() {
    const settings = await this.attendanceSettingRepository.findOne({
      where: {},
      order: { createdAt: "ASC" },
    });

    return normalizeWeeklyDaysOff(settings?.weeklyDaysOff);
  }

  private async getPayrollMonthSetting(month: number, year: number) {
    const weeklyDaysOff = await this.getWeeklyDaysOff();
    const holidayStats = await this.getPaidHolidayStats(month, year, weeklyDaysOff);
    const holidayPaidDays = holidayStats.paidDays;

    return {
      standardWorkDay: countStandardWorkDays(month, year, weeklyDaysOff),
      holidayPaidDays,
      holidayBonusAmount: holidayPaidDays > 0 ? roundCurrency(holidayStats.bonusTotal / holidayPaidDays) : 0,
      holidayBonusTotal: holidayStats.bonusTotal,
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

  private createTransferInfoSheet(records: SalaryRecord[]) {
    const bankCodes = Array.from(
      new Set(
        records
          .map((record) => normalizeBankCode(getPrimaryBankAccount(record.employee.bankAccounts)?.bankName ?? ""))
          .filter(Boolean),
      ),
    );
    const rows = bankCodes.length > 0 ? bankCodes.map((bankCode) => ["", "", "", "", "", "", bankCode]) : [[]];
    return XLSX.utils.aoa_to_sheet(rows);
  }
}

function getPrimaryBankAccount(bankAccounts: SalaryRecord["employee"]["bankAccounts"] = []) {
  return bankAccounts.find((bankAccount) => bankAccount.isPrimary) ?? bankAccounts[0];
}

function createMailTransporter(settings: EmailTransportSettings) {
  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpPort === 465,
    auth:
      settings.smtpUser && settings.smtpPass
        ? {
            user: settings.smtpUser,
            pass: settings.smtpPass,
          }
        : undefined,
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Không rõ nguyên nhân";
}

type PdfTableColumn<T> = {
  header: string;
  width: number;
  align?: "left" | "center" | "right";
  getValue: (row: T) => string;
};

type PdfLabelValueRow = {
  label: string;
  value: string;
};

const PAYSLIP_PDF_OPTIONS = { margin: 28, size: "A4", layout: "landscape" } as const;

async function createPayslipPdf(record: SalaryRecord, attendanceRows: AttendanceSummary[] = []) {
  return new Promise<Buffer>((resolve, reject) => {
    const document = new PDFDocument(PAYSLIP_PDF_OPTIONS);
    const chunks: Buffer[] = [];
    const fontPath = getPdfFontPath();
    const normalizeText = fontPath ? (value: string) => value : toPdfSafeText;

    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    if (fontPath) {
      document.registerFont("Body", fontPath);
      document.font("Body");
    }

    const periodLabel = `${String(record.salaryPeriod.month).padStart(2, "0")}/${record.salaryPeriod.year}`;
    document.fillColor("#101828").fontSize(18).text(normalizeText("PHIẾU LƯƠNG"), { align: "center" });
    document.moveDown(0.25);
    document.fillColor("#344054").fontSize(10).text(normalizeText(`Kỳ lương: ${periodLabel}`), { align: "center" });
    document.moveDown(0.8);

    drawPdfSectionTitle(document, normalizeText, "Thông tin nhân viên");
    drawPdfInfoTable(document, normalizeText, [
      { label: "Mã nhân viên", value: record.employee.employeeCode },
      { label: "Họ tên", value: record.employee.fullName },
      { label: "Email", value: record.employee.email || "-" },
      { label: "Phòng ban", value: record.employee.department?.name ?? "-" },
      { label: "Chức vụ", value: record.employee.position?.name ?? "-" },
      { label: "Ngày công", value: formatWorkDay(record.workDay) },
      { label: "Thực nhận", value: formatCurrency(record.netSalary) },
      { label: "Trạng thái", value: record.status },
    ]);

    drawPdfSectionTitle(document, normalizeText, "Bảng chấm công");
    drawPdfTable(document, normalizeText, buildAttendancePdfColumns(), attendanceRows, {
      emptyText: "Không có dữ liệu chấm công trong kỳ này",
      rowHeight: 17,
      fontSize: 7.5,
    });

    drawPdfSectionTitle(document, normalizeText, "Bảng lương");
    const payrollRows = [
      { label: "Lương cài đặt", value: formatCurrency(record.configuredSalary) },
      { label: "Lương BHXH", value: formatCurrency(record.insuranceSalary) },
      { label: "Ngày công", value: formatWorkDay(record.workDay) },
      { label: "Lương cố định", value: formatCurrency(record.fixedDailySalary) },
      { label: "Trách nhiệm", value: formatCurrency(record.responsibilityAllowance) },
      { label: "Ăn ca", value: formatCurrency(record.mealAllowance) },
      { label: "Điện thoại", value: formatCurrency(record.phoneAllowance) },
      { label: "KPI", value: formatCurrency(record.kpiAllowance) },
      { label: "Tổng lương ngày", value: formatCurrency(record.dailyTotal) },
      { label: "Lương trong tháng", value: formatCurrency(record.baseSalary) },
      { label: "Lương tăng ca", value: formatCurrency(record.overtimeTotal) },
      { label: "Thưởng ngày lễ", value: formatCurrency(record.bonusTotal) },
      { label: "Thưởng", value: formatCurrency(record.bonus) },
      { label: "Tổng lương", value: formatCurrency(record.grossSalary) },
      { label: "Tổng giảm trừ", value: formatCurrency(record.deductionTotal) },
      { label: "Thực nhận", value: formatCurrency(record.netSalary) },
    ];
    drawPdfTable(document, normalizeText, buildLabelValuePdfColumns(), payrollRows, {
      rowHeight: 18,
      fontSize: 8.5,
    });

    if (record.details?.length) {
      drawPdfSectionTitle(document, normalizeText, "Chi tiết phát sinh");
      drawPdfTable(
        document,
        normalizeText,
        buildLabelValuePdfColumns(),
        record.details.map((detail) => ({ label: detail.label, value: formatCurrency(detail.amount) })),
        { rowHeight: 18, fontSize: 8.5 },
      );
    }

    ensurePdfSpace(document, 18);
    document
      .fontSize(9)
      .fillColor("#667085")
      .text(normalizeText(`Gửi lúc ${formatPdfDate(new Date())} bởi hệ thống nhân sự Dela Embroidery.`));
    document.end();
  });
}

function drawPdfSectionTitle(
  document: PDFKit.PDFDocument,
  normalizeText: (value: string) => string,
  title: string,
) {
  ensurePdfSpace(document, 24);
  document.moveDown(0.55);
  document.fillColor("#101828").fontSize(11).text(normalizeText(title), document.page.margins.left, document.y, {
    width: getPdfContentWidth(document),
  });
  document.moveDown(0.35);
}

function drawPdfInfoTable(
  document: PDFKit.PDFDocument,
  normalizeText: (value: string) => string,
  rows: PdfLabelValueRow[],
) {
  const columns = [
    { header: "Trường", width: 82, getValue: (row: PdfLabelValueRow) => row.label },
    { header: "Giá trị", width: 150, getValue: (row: PdfLabelValueRow) => row.value },
    { header: "Trường", width: 82, getValue: (row: PdfLabelValueRow) => row.label },
    { header: "Giá trị", width: 150, getValue: (row: PdfLabelValueRow) => row.value },
  ];
  const pairedRows: PdfLabelValueRow[] = [];

  for (let index = 0; index < rows.length; index += 2) {
    const first = rows[index];
    const second = rows[index + 1] ?? { label: "", value: "" };
    pairedRows.push({
      label: `${first.label}::${second.label}`,
      value: `${first.value}::${second.value}`,
    });
  }

  drawPdfTable(document, normalizeText, columns, pairedRows, {
    rowHeight: 18,
    fontSize: 8.5,
    mapCellValue: (columnIndex, row) => {
      const labels = row.label.split("::");
      const values = row.value.split("::");
      return columnIndex === 0 ? labels[0] : columnIndex === 1 ? values[0] : columnIndex === 2 ? labels[1] : values[1];
    },
  });
}

function drawPdfTable<T>(
  document: PDFKit.PDFDocument,
  normalizeText: (value: string) => string,
  columns: PdfTableColumn<T>[],
  rows: T[],
  options: {
    emptyText?: string;
    rowHeight?: number;
    headerHeight?: number;
    fontSize?: number;
    mapCellValue?: (columnIndex: number, row: T) => string;
  } = {},
) {
  const rowHeight = options.rowHeight ?? 18;
  const headerHeight = options.headerHeight ?? 18;
  const fontSize = options.fontSize ?? 8;
  const startX = document.page.margins.left;
  const tableWidth = columns.reduce((total, column) => total + column.width, 0);
  const drawHeader = () => {
    ensurePdfSpace(document, headerHeight + rowHeight);
    let x = startX;
    const y = document.y;
    for (const column of columns) {
      drawPdfRect(document, x, y, column.width, headerHeight, "#eaf5fb", "#cfd9e3");
      drawPdfText(document, normalizeText(column.header), x, y, column.width, headerHeight, {
        align: column.align ?? "center",
        color: "#0b2f4a",
        fontSize,
      });
      x += column.width;
    }
    document.y = y + headerHeight;
  };

  drawHeader();

  if (rows.length === 0) {
    const y = document.y;
    drawPdfRect(document, startX, y, tableWidth, rowHeight, "#ffffff", "#d8e1ea");
    drawPdfText(document, normalizeText(options.emptyText ?? "Không có dữ liệu"), startX, y, tableWidth, rowHeight, {
      align: "center",
      color: "#667085",
      fontSize,
    });
    document.y = y + rowHeight;
    return;
  }

  rows.forEach((row, rowIndex) => {
    if (document.y + rowHeight > getPdfBottomLimit(document)) {
      document.addPage(PAYSLIP_PDF_OPTIONS);
      drawHeader();
    }

    let x = startX;
    const y = document.y;
    const background = rowIndex % 2 === 0 ? "#ffffff" : "#f8fbfd";
    for (const [columnIndex, column] of columns.entries()) {
      const value = options.mapCellValue?.(columnIndex, row) ?? column.getValue(row);
      drawPdfRect(document, x, y, column.width, rowHeight, background, "#d8e1ea");
      drawPdfText(document, normalizeText(value || "-"), x, y, column.width, rowHeight, {
        align: column.align ?? "left",
        color: "#101828",
        fontSize,
      });
      x += column.width;
    }
    document.y = y + rowHeight;
  });
}

function drawPdfRect(
  document: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  stroke: string,
) {
  document.save().fillColor(fill).rect(x, y, width, height).fill().restore();
  document.save().strokeColor(stroke).lineWidth(0.5).rect(x, y, width, height).stroke().restore();
}

function drawPdfText(
  document: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: { align: "left" | "center" | "right"; color: string; fontSize: number },
) {
  document.fillColor(options.color).fontSize(options.fontSize).text(text, x + 4, y + 4, {
    align: options.align,
    height: Math.max(8, height - 8),
    lineBreak: false,
    width: Math.max(8, width - 8),
  });
}

function buildAttendancePdfColumns(): PdfTableColumn<AttendanceSummary>[] {
  return [
    { header: "Ngày", width: 54, getValue: (row) => formatPdfDateOnly(row.workDate) },
    { header: "Vào", width: 38, align: "center", getValue: (row) => formatPdfTime(row.checkInAt) },
    { header: "Ra", width: 38, align: "center", getValue: (row) => formatPdfTime(row.checkOutAt) },
    { header: "Ca 1 vào", width: 43, align: "center", getValue: (row) => formatPdfTime(row.morningCheckInAt) },
    { header: "Ca 1 ra", width: 43, align: "center", getValue: (row) => formatPdfTime(row.morningCheckOutAt) },
    { header: "Ca 2 vào", width: 43, align: "center", getValue: (row) => formatPdfTime(row.afternoonCheckInAt) },
    { header: "Ca 2 ra", width: 43, align: "center", getValue: (row) => formatPdfTime(row.afternoonCheckOutAt) },
    { header: "Ca 3 vào", width: 43, align: "center", getValue: (row) => formatPdfTime(row.nightCheckInAt) },
    { header: "Ca 3 ra", width: 43, align: "center", getValue: (row) => formatPdfTime(row.nightCheckOutAt) },
    { header: "Công", width: 36, align: "right", getValue: (row) => formatWorkDay(row.workDay) },
    { header: "Trễ", width: 36, align: "right", getValue: (row) => formatPdfMinutes(row.lateMinutes) },
    { header: "Sớm", width: 36, align: "right", getValue: (row) => formatPdfMinutes(row.earlyLeaveMinutes) },
    { header: "Tăng ca", width: 45, align: "right", getValue: (row) => formatPdfMinutes(row.overtimeMinutes) },
    { header: "Trạng thái", width: 60, align: "center", getValue: (row) => formatAttendanceStatus(row.status) },
  ];
}

function buildLabelValuePdfColumns(): PdfTableColumn<PdfLabelValueRow>[] {
  return [
    { header: "Khoản mục", width: 230, getValue: (row) => row.label },
    { header: "Giá trị", width: 170, align: "right", getValue: (row) => row.value },
  ];
}

function ensurePdfSpace(document: PDFKit.PDFDocument, requiredHeight: number) {
  if (document.y + requiredHeight > getPdfBottomLimit(document)) {
    document.addPage(PAYSLIP_PDF_OPTIONS);
  }
}

function getPdfBottomLimit(document: PDFKit.PDFDocument) {
  return document.page.height - document.page.margins.bottom;
}

function getPdfContentWidth(document: PDFKit.PDFDocument) {
  return document.page.width - document.page.margins.left - document.page.margins.right;
}

function getPdfFontPath() {
  return [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
  ].find((path) => existsSync(path));
}

function toPdfSafeText(value: string) {
  return removeVietnameseMarks(value).replace(/đ/g, "d").replace(/Đ/g, "D").replace(/₫/g, "VND");
}

function formatCurrency(value: unknown) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(roundCurrency(toFiniteNumber(value)))} đ`;
}

function formatWorkDay(value: unknown) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(roundNumber(toFiniteNumber(value)));
}

function formatPdfDate(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(value);
}

function formatPdfDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return value || "-";
  }
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

function formatPdfTime(value?: Date | null) {
  return formatVietnamTime(value) ?? "-";
}

function formatPdfMinutes(value: unknown) {
  return `${Math.round(toFiniteNumber(value))}p`;
}

function formatAttendanceStatus(value: string) {
  const statusLabels: Record<string, string> = {
    present: "Có mặt",
    missing: "Thiếu chấm",
    absent: "Nghỉ",
    leave: "Nghỉ phép",
    late: "Đi trễ",
  };
  return statusLabels[value] ?? value ?? "-";
}

function getDependentNote(record: SalaryRecord) {
  return record.details?.find((detail) => detail.label.toLocaleLowerCase("vi-VN").includes("phụ thuộc"))?.label ?? "";
}

function formatTransferAmount(value: unknown) {
  return ` ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(roundCurrency(toFiniteNumber(value)))} `;
}

function normalizeTransferText(value: string) {
  return removeVietnameseMarks(value).toLocaleUpperCase("vi-VN").trim();
}

function normalizeBankCode(value: string) {
  const trimmedValue = value.trim();
  const bankCode = trimmedValue.match(/\b\d{8}\b/)?.[0];
  return bankCode ?? trimmedValue;
}

function removeVietnameseMarks(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function groupByEmployee(summaries: AttendanceSummary[]) {
  const map = new Map<string, AttendanceSummary[]>();
  for (const summary of summaries) {
    const employeeSummaries = map.get(summary.employee.id) ?? [];
    employeeSummaries.push(summary);
    map.set(summary.employee.id, employeeSummaries);
  }
  return map;
}

export function getMonthRange(month: number, year: number) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = `${year}-${String(month).padStart(2, "0")}-${String(getDaysInVietnamMonth(month, year)).padStart(2, "0")}`;
  return { from, to };
}

function countStandardWorkDays(month: number, year: number, weeklyDaysOff: number[] = DEFAULT_WEEKLY_DAYS_OFF) {
  const daysInMonth = getDaysInVietnamMonth(month, year);
  let workDays = 0;
  const daysOff = new Set(normalizeWeeklyDaysOff(weeklyDaysOff));

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!daysOff.has(getVietnamDayOfWeek(date))) {
      workDays += 1;
    }
  }

  return workDays;
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

function isWeeklyDayOff(value: string, weeklyDaysOff: number[] = DEFAULT_WEEKLY_DAYS_OFF) {
  return new Set(normalizeWeeklyDaysOff(weeklyDaysOff)).has(getVietnamDayOfWeek(value));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function roundCurrency(value: number) {
  return Math.round(Number.isFinite(value) ? value : 0);
}

function roundNumber(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return Math.round(safeValue * 100) / 100;
}

function toFiniteNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    const numberValue = Number(trimmedValue);
    if (Number.isFinite(numberValue)) {
      return numberValue;
    }

    const normalizedCurrencyValue = trimmedValue.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const parsedCurrencyValue = Number(normalizedCurrencyValue);
    return Number.isFinite(parsedCurrencyValue) ? parsedCurrencyValue : fallback;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function normalizeFormulaSettingSnapshot(value: unknown): PayrollFormulaSettingDto {
  const source = value && typeof value === "object" ? (value as Partial<PayrollFormulaSettingDto>) : {};
  return {
    insuranceBaseSalary: Number(source.insuranceBaseSalary ?? DEFAULT_FORMULA_SETTING.insuranceBaseSalary),
    employeeInsuranceRate: Number(source.employeeInsuranceRate ?? DEFAULT_FORMULA_SETTING.employeeInsuranceRate),
    employerInsuranceRate: Number(source.employerInsuranceRate ?? DEFAULT_FORMULA_SETTING.employerInsuranceRate),
    defaultMealAllowance: Number(source.defaultMealAllowance ?? DEFAULT_FORMULA_SETTING.defaultMealAllowance),
    defaultPhoneAllowance: Number(source.defaultPhoneAllowance ?? DEFAULT_FORMULA_SETTING.defaultPhoneAllowance),
    columnFormulas: normalizeColumnFormulaList(source.columnFormulas),
  };
}

function normalizeColumnFormulaList(value: unknown): PayrollFormulaSettingDto["columnFormulas"] {
  const fallback = DEFAULT_FORMULA_SETTING.columnFormulas;
  const fallbackByKey = new Map(fallback.map((formula) => [formula.key, formula]));
  const formulasByKey = new Map<PayrollFormulaColumnKey, PayrollFormulaSettingDto["columnFormulas"][number]>();

  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isColumnFormula(item) || !fallbackByKey.has(item.key)) {
        continue;
      }

      const fallbackFormula = fallbackByKey.get(item.key);
      const formula = normalizeDefaultDailyAllowanceFormula(item.key, item.formula.trim());
      formulasByKey.set(item.key, {
        key: item.key,
        name: item.name.trim() || fallbackFormula?.name || item.key,
        formula: formula || fallbackFormula?.formula || "0",
      });
    }
  }

  return fallback.map((formula) => formulasByKey.get(formula.key) ?? { ...formula });
}

function normalizeDefaultDailyAllowanceFormula(key: PayrollFormulaColumnKey, formula: string) {
  const compactFormula = formula.replace(/\s+/g, "");
  if (key === "mealAllowance" && compactFormula === "phuCapAnCa/ngayCong") {
    return "anCaMacDinh";
  }
  if (key === "phoneAllowance" && compactFormula === "phuCapDienThoai/ngayCong") {
    return "dienThoaiMacDinh";
  }
  if (key === "netSalary" && compactFormula === "tongLuong-tongGiamTru") {
    return "tongLuong - tongGiamTru + thuong";
  }
  if (key === "grossSalary" && compactFormula === "luongThang+luongTangCa") {
    return "luongThang + luongTangCa + thuongLe";
  }
  return formula;
}

function getLegacyColumnFormulas(setting: PayrollFormulaSetting): PayrollFormulaSettingDto["columnFormulas"] {
  const earningCategories = normalizeLegacyCategoryList(setting.earningCategories);
  const deductionCategories = normalizeLegacyCategoryList(setting.deductionCategories);
  const findCategoryFormula = (categories: LegacyFormulaCategory[], key: string, fallback: string) =>
    categories.find((category) => category.key === key)?.formula || fallback;

  return DEFAULT_FORMULA_SETTING.columnFormulas.map((formula) => {
    const legacyFormulaByKey: Partial<Record<PayrollFormulaColumnKey, string>> = {
      fixedDailySalary: findCategoryFormula(earningCategories, "luongCoDinh", formula.formula),
      responsibilityAllowance: findCategoryFormula(earningCategories, "trachNhiem", formula.formula),
      mealAllowance: findCategoryFormula(earningCategories, "anCa", formula.formula),
      phoneAllowance: findCategoryFormula(earningCategories, "dienThoai", formula.formula),
      kpiAllowance: findCategoryFormula(earningCategories, "kpi", formula.formula),
      dailyTotal: setting.dailySalaryFormula || formula.formula,
      grossSalary: setting.grossSalaryFormula || formula.formula,
      insuranceTotal: findCategoryFormula(deductionCategories, "bhxhNhanVien", formula.formula),
      taxTotal: findCategoryFormula(deductionCategories, "thueTNCN", formula.formula),
      advanceTotal: findCategoryFormula(deductionCategories, "tamUng", formula.formula),
      deductionTotal: setting.deductionFormula || formula.formula,
      netSalary: setting.netSalaryFormula || formula.formula,
    };

    return {
      ...formula,
      formula: legacyFormulaByKey[formula.key] ?? formula.formula,
    };
  });
}

type LegacyFormulaCategory = {
  key: string;
  name: string;
  formula: string;
};

function normalizeLegacyCategoryList(value: unknown): LegacyFormulaCategory[] {
  if (!Array.isArray(value)) {
    return [];
  }

  if (value.every(isLegacyFormulaCategory)) {
    return value.map((item) => ({
      key: item.key.trim(),
      name: item.name.trim(),
      formula: item.formula.trim(),
    }));
  }

  if (value.every((item) => typeof item === "string")) {
    return value.map((item, index): LegacyFormulaCategory => ({
      key: `muc${index + 1}`,
      name: item.trim(),
      formula: "0",
    }));
  }

  return [];
}

function isColumnFormula(value: unknown): value is PayrollFormulaSettingDto["columnFormulas"][number] {
  return (
    value !== null &&
    typeof value === "object" &&
    "key" in value &&
    "name" in value &&
    "formula" in value &&
    typeof value.key === "string" &&
    DEFAULT_FORMULA_SETTING.columnFormulas.some((formula) => formula.key === value.key) &&
    typeof value.name === "string" &&
    typeof value.formula === "string"
  );
}

function isLegacyFormulaCategory(value: unknown): value is LegacyFormulaCategory {
  return (
    value !== null &&
    typeof value === "object" &&
    "key" in value &&
    "name" in value &&
    "formula" in value &&
    typeof value.key === "string" &&
    typeof value.name === "string" &&
    typeof value.formula === "string"
  );
}

function getDefaultFormula(key: PayrollFormulaColumnKey) {
  return DEFAULT_FORMULA_SETTING.columnFormulas.find((formula) => formula.key === key)?.formula ?? "0";
}

function isDeductionFormulaKey(key: PayrollFormulaColumnKey) {
  return ["insuranceTotal", "taxTotal", "advanceTotal", "deductionTotal"].includes(key);
}

function getEmployeeHolidayWorkStats(summaries: AttendanceSummary[], holidaysByDate: Map<string, Holiday>) {
  let workDay = 0;
  let fixedBonusTotal = 0;

  for (const summary of summaries) {
    const holiday = holidaysByDate.get(summary.workDate);
    if (!holiday) {
      continue;
    }

    const workedMinutes = getSummaryWorkedMinutes(summary);
    const summaryWorkDay = workedMinutes > 0 ? Math.min(1, roundNumber(workedMinutes / MINUTES_PER_WORK_DAY)) : 0;
    if (summaryWorkDay <= 0) {
      continue;
    }

    workDay += summaryWorkDay;
    fixedBonusTotal += Number(holiday.bonusAmount ?? 0) * summaryWorkDay;
  }

  return {
    workDay: roundNumber(workDay),
    fixedBonusTotal: roundCurrency(fixedBonusTotal),
  };
}

function getSummaryWorkedMinutes(summary: AttendanceSummary) {
  const overtimeMinutes = Number(summary.overtimeMinutes ?? 0);
  if (overtimeMinutes > 0) {
    return overtimeMinutes;
  }

  if (summary.checkInAt && summary.checkOutAt) {
    return Math.max(0, Math.round((summary.checkOutAt.getTime() - summary.checkInAt.getTime()) / 60_000));
  }

  return Math.max(0, Number(summary.workDay ?? 0) * MINUTES_PER_WORK_DAY);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value)}%`;
}

function formatMultiplier(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
}

function filterPayrollRecord<TRecord extends Record<string, unknown>>(
  record: TRecord,
  visibleColumns: PayrollEmployeeViewColumn[],
) {
  const visibleSet = new Set<string>(visibleColumns);
  const filteredRecord: Record<string, unknown> = {
    id: record.id,
    employeeId: record.employeeId,
    details: [],
  };

  for (const column of payrollEmployeeViewColumns) {
    if (visibleSet.has(column)) {
      filteredRecord[column] = record[column];
    }
  }

  return filteredRecord;
}

function filterPayrollTotals<TTotals extends Record<string, unknown>>(
  totals: TTotals,
  visibleColumns: PayrollEmployeeViewColumn[],
) {
  const visibleSet = new Set<string>(visibleColumns);
  return {
    employeeCount: totals.employeeCount,
    workDay: visibleSet.has("workDay") ? totals.workDay : undefined,
    overtimeTotal: visibleSet.has("overtimeTotal") ? totals.overtimeTotal : undefined,
    netSalary: visibleSet.has("netSalary") ? totals.netSalary : undefined,
  };
}
