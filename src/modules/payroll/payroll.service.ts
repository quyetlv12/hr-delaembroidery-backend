import * as XLSX from "xlsx";
import { Between } from "typeorm";

import { HttpError } from "../../common/http-error";
import { AppDataSource } from "../../database/data-source";
import {
  Allowance,
  AttendanceMonthSetting,
  AttendanceSetting,
  AttendanceSummary,
  Deduction,
  Employee,
  SalaryDetail,
  SalaryPeriod,
  SalaryRecord,
} from "../../entities";
import { calculateExcelPayroll, DEFAULT_INSURANCE_SALARY } from "./payroll-formula";
import type { PayrollPeriodDto } from "./payroll.dto";

const DEFAULT_OVERTIME_RATE = 1.5;
const DEFAULT_TRANSFER_DEBIT_ACCOUNT = "111003013254";
const DEFAULT_TRANSFER_BANK_CODE = "79321001";

export class PayrollService {
  private readonly attendanceRepository = AppDataSource.getRepository(AttendanceSummary);
  private readonly attendanceMonthSettingRepository = AppDataSource.getRepository(AttendanceMonthSetting);
  private readonly attendanceSettingRepository = AppDataSource.getRepository(AttendanceSetting);
  private readonly employeeRepository = AppDataSource.getRepository(Employee);
  private readonly allowanceRepository = AppDataSource.getRepository(Allowance);
  private readonly deductionRepository = AppDataSource.getRepository(Deduction);
  private readonly periodRepository = AppDataSource.getRepository(SalaryPeriod);
  private readonly recordRepository = AppDataSource.getRepository(SalaryRecord);
  private readonly detailRepository = AppDataSource.getRepository(SalaryDetail);

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
    return {
      period: this.toPeriodDto(period),
      records: records.map((record) => this.toRecordDto(record)),
      totals: this.getTotals(records),
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
      });
    }

    return this.list(dto);
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
          type: "overtime",
          label: `${roundNumber(overtimeMinutes / 60)} giờ tăng ca x hệ số ${input.overtimeRate}`,
          amount: payrollFormula.overtimeSalary,
        },
        {
          type: "gross",
          label: "Tổng lương = Lương trong tháng + Lương làm thêm giờ",
          amount: payrollFormula.grossSalary,
        },
        { type: "insurance", label: "BHXH NLĐ 10.5%", amount: -payrollFormula.employeeInsuranceDeduction },
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
    const insuranceSalary = storedInsuranceSalary > 0 ? storedInsuranceSalary : configuredSalary > 0 ? DEFAULT_INSURANCE_SALARY : 0;
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
      overtimeTotal: Number(record.overtimeTotal),
      grossSalary,
      employerInsuranceTotal,
      insuranceTotal: Number(record.insuranceTotal),
      totalInsurance,
      taxTotal: Number(record.taxTotal),
      advanceTotal: Number(record.advanceTotal),
      deductionTotal: Number(record.deductionTotal),
      netSalary: Number(record.netSalary),
      status: record.status,
      details: record.details?.map((detail) => ({
        id: detail.id,
        type: detail.type,
        label: detail.label,
        amount: Number(detail.amount),
      })) ?? [],
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
    const settings = await this.attendanceMonthSettingRepository.findOne({
      where: { month, year },
    });
    const holidayPaidDays = Number(settings?.holidayPaidDays ?? 0);
    const holidayBonusAmount = Number(settings?.holidayBonusAmount ?? 0);

    return {
      standardWorkDay: Number(settings?.standardWorkDay ?? countStandardWorkDays(month, year)),
      holidayPaidDays,
      holidayBonusAmount,
      holidayBonusTotal: roundCurrency(holidayPaidDays * holidayBonusAmount),
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

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function roundCurrency(value: number) {
  return Math.round(value);
}

function roundNumber(value: number) {
  return Math.round(value * 100) / 100;
}
