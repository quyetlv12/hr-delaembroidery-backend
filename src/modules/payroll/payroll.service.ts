import * as XLSX from "xlsx";
import { Between, Not } from "typeorm";

import { HttpError } from "../../common/http-error";
import { AppDataSource } from "../../database/data-source";
import {
  Allowance,
  AttendanceSetting,
  AttendanceSummary,
  Deduction,
  Employee,
  Holiday,
  PayrollFormulaHistory,
  PayrollFormulaSetting,
  PayrollFormulaTemplate,
  SalaryDetail,
  SalaryPeriod,
  SalaryRecord,
} from "../../entities";
import {
  payrollEmployeeViewColumns,
  type PayrollEmployeeViewColumn,
} from "../employee-view-settings/employee-view-settings.constants";
import { EmployeeViewSettingsService } from "../employee-view-settings/employee-view-settings.service";
import { calculateExcelPayroll, DEFAULT_PAYROLL_FORMULA_SETTING } from "./payroll-formula";
import type {
  PayrollFormulaColumnKey,
  PayrollFormulaSettingDto,
  PayrollFormulaTemplateCreateDto,
  PayrollPeriodDto,
} from "./payroll.dto";

const DEFAULT_OVERTIME_RATE = 1.5;
const DEFAULT_TRANSFER_DEBIT_ACCOUNT = "111003013254";
const DEFAULT_TRANSFER_BANK_CODE = "79321001";
const DEFAULT_FORMULA_SETTING: PayrollFormulaSettingDto = DEFAULT_PAYROLL_FORMULA_SETTING;

type FormulaAuditUser = {
  id?: string;
  loginCode?: string;
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
  private readonly formulaSettingRepository = AppDataSource.getRepository(PayrollFormulaSetting);
  private readonly formulaHistoryRepository = AppDataSource.getRepository(PayrollFormulaHistory);
  private readonly formulaTemplateRepository = AppDataSource.getRepository(PayrollFormulaTemplate);
  private readonly employeeViewSettingsService = new EmployeeViewSettingsService();

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
    const [summaries, employees, allowances, deductions] = await Promise.all([
      this.attendanceRepository.find({
        where: { workDate: Between(dateRange.from, dateRange.to) },
        relations: { employee: true },
      }),
      this.employeeRepository.find({ where: { status: "active" } }),
      this.allowanceRepository.find({ where: { isActive: true }, relations: { employee: true } }),
      this.deductionRepository.find({ where: { isActive: true }, relations: { employee: true } }),
    ]);

    const summariesByEmployee = groupByEmployee(summaries);
    const monthSetting = await this.getPayrollMonthSetting(dto.month, dto.year);
    const standardWorkDay = monthSetting.standardWorkDay;
    const holidayBonusTotal = monthSetting.holidayBonusTotal;
    const overtimeRate = await this.getOvertimeRate();
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
        holidayBonusTotal,
        holidayPaidDays: monthSetting.holidayPaidDays,
        overtimeRate,
        formulaSetting,
      });
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

  private async upsertRecord(input: {
    employee: Employee;
    period: SalaryPeriod;
    summaries: AttendanceSummary[];
    allowances: Allowance[];
    deductions: Deduction[];
    standardWorkDay: number;
    holidayBonusTotal: number;
    holidayPaidDays: number;
    overtimeRate: number;
    formulaSetting: PayrollFormulaSettingDto;
  }) {
    const workDay = sum(input.summaries.map((summary) => Number(summary.workDay)));
    const overtimeMinutes = sum(input.summaries.map((summary) => summary.overtimeMinutes));
    const payrollFormula = calculateExcelPayroll({
      actualSalary: Number(input.employee.baseSalary),
      workDay,
      standardWorkDay: input.standardWorkDay,
      overtimeMinutes,
      overtimeRate: input.overtimeRate,
      holidayBonusTotal: input.holidayBonusTotal,
      insuranceSalary: input.formulaSetting.insuranceBaseSalary,
      employeeInsuranceRate: input.formulaSetting.employeeInsuranceRate,
      employerInsuranceRate: input.formulaSetting.employerInsuranceRate,
      defaultMealAllowance: input.formulaSetting.defaultMealAllowance,
      defaultPhoneAllowance: input.formulaSetting.defaultPhoneAllowance,
      formulas: {
        columnFormulas: input.formulaSetting.columnFormulas,
      },
      allowances: input.allowances,
      deductions: input.deductions,
    });

    const existingRecord = await this.recordRepository.findOne({
      where: {
        employee: { id: input.employee.id },
        salaryPeriod: { id: input.period.id },
      },
      relations: { employee: true, salaryPeriod: true },
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
      // bonus (thưởng) is set manually per employee — preserve existing value on recalculate
      bonus: existingRecord ? existingRecord.bonus : "0",
      overtimeTotal: String(payrollFormula.overtimeSalary),
      grossSalary: String(payrollFormula.grossSalary),
      employerInsuranceTotal: String(payrollFormula.employerInsuranceTotal),
      insuranceTotal: String(payrollFormula.employeeInsuranceDeduction),
      totalInsurance: String(payrollFormula.totalInsurance),
      taxTotal: String(payrollFormula.personalIncomeTax),
      advanceTotal: String(payrollFormula.advanceTotal),
      deductionTotal: String(payrollFormula.totalDeduction),
      netSalary: String(payrollFormula.netSalary + (existingRecord ? Number(existingRecord.bonus) : 0)),
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
          type: "overtime",
          label: `${roundNumber(overtimeMinutes / 60)} giờ tăng ca x hệ số ${input.overtimeRate}`,
          amount: payrollFormula.overtimeSalary,
        },
        {
          type: "gross",
          label: "Tổng lương = Lương trong tháng + Lương làm thêm giờ",
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
        { type: "bonus", label: `Tiền cộng ngày lễ ${input.holidayPaidDays} ngày`, amount: payrollFormula.bonusTotal },
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

  private async getOvertimeRate() {
    const settings = await this.attendanceSettingRepository.findOne({
      where: {},
      order: { createdAt: "ASC" },
    });

    return Number(settings?.overtimeRate ?? DEFAULT_OVERTIME_RATE);
  }

  private async getPayrollMonthSetting(month: number, year: number) {
    const holidayStats = await this.getPaidHolidayStats(month, year);
    const holidayPaidDays = holidayStats.paidDays;

    return {
      standardWorkDay: Math.max(0, countStandardWorkDays(month, year) - holidayPaidDays),
      holidayPaidDays,
      holidayBonusAmount: holidayPaidDays > 0 ? roundCurrency(holidayStats.bonusTotal / holidayPaidDays) : 0,
      holidayBonusTotal: holidayStats.bonusTotal,
    };
  }

  private async getPaidHolidayStats(month: number, year: number) {
    const { from, to } = getMonthRange(month, year);
    const holidays = await this.holidayRepository.find({
      where: { holidayDate: Between(from, to), isPaid: true },
    });
    const paidHolidays = holidays.filter((holiday) => !isSunday(holiday.holidayDate));
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

function getDependentNote(record: SalaryRecord) {
  return record.details?.find((detail) => detail.label.toLocaleLowerCase("vi-VN").includes("phụ thuộc"))?.label ?? "";
}

function formatTransferAmount(value: number) {
  return ` ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(roundCurrency(value))} `;
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
  const toDate = new Date(year, month, 0);
  const to = `${year}-${String(month).padStart(2, "0")}-${String(toDate.getDate()).padStart(2, "0")}`;
  return { from, to };
}

function countStandardWorkDays(month: number, year: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  let workDays = 0;

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month - 1, day);
    if (date.getDay() !== 0) {
      workDays += 1;
    }
  }

  return workDays;
}

function isSunday(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).getDay() === 0;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function roundCurrency(value: number) {
  return Math.round(value);
}

function roundNumber(value: number) {
  return Math.round(value * 100) / 100;
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
