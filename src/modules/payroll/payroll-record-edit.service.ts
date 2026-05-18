import { HttpError } from "../../common/http-error";
import { AppDataSource } from "../../database/data-source";
import { PayrollFormulaSetting, PayrollRecordHistory, SalaryRecord } from "../../entities";
import type { PayrollRecordSnapshot } from "../../entities/PayrollRecordHistory";
import type { PayrollRecordUpdateDto } from "./payroll.dto";
import { DEFAULT_PAYROLL_FORMULA_SETTING } from "./payroll-formula";

// bonus is editable but not in the formula-driven fields
type EditablePayrollField = keyof PayrollRecordUpdateDto;

type PayrollRecordState = Record<EditablePayrollField, number>;

type PayrollAuditUser = {
  id?: string;
  loginCode?: string;
};

const dayFields: EditablePayrollField[] = ["workDay", "overtimeWorkDay", "totalWorkDay"];
const dailyComponentFields: EditablePayrollField[] = [
  "fixedDailySalary",
  "responsibilityAllowance",
  "mealAllowance",
  "phoneAllowance",
  "kpiAllowance",
];

export class PayrollRecordEditService {
  private readonly recordRepository = AppDataSource.getRepository(SalaryRecord);
  private readonly recordHistoryRepository = AppDataSource.getRepository(PayrollRecordHistory);
  private readonly formulaSettingRepository = AppDataSource.getRepository(PayrollFormulaSetting);

  async updateRecord(recordId: string, dto: PayrollRecordUpdateDto, user?: PayrollAuditUser) {
    const record = await this.recordRepository.findOne({
      where: { id: recordId },
      relations: { employee: true, salaryPeriod: true },
    });
    if (!record) {
      throw new HttpError(404, "SALARY_RECORD_NOT_FOUND", "Không tìm thấy dòng bảng lương");
    }
    if (record.salaryPeriod.status === "locked" || record.status === "locked") {
      throw new HttpError(400, "PAYROLL_LOCKED", "Kỳ lương đã bị khóa");
    }

    const previousSnapshot = this.toSnapshot(record);
    const state = this.toState(record);
    const touched = new Set(Object.keys(dto) as EditablePayrollField[]);
    for (const field of touched) {
      state[field] = sanitizePayrollValue(field, dto[field]);
    }

    await this.recalculateDerivedFields(state, touched);
    this.applyState(record, state);
    const savedRecord = await this.recordRepository.save(record);
    const nextSnapshot = this.toSnapshot(savedRecord);
    const changedFields = getChangedFields(previousSnapshot, nextSnapshot);

    if (changedFields.length > 0) {
      await this.recordHistoryRepository.save(
        this.recordHistoryRepository.create({
          action: "update",
          changedByLoginCode: user?.loginCode ?? null,
          changedByUserId: user?.id ?? null,
          changedFields,
          employee: savedRecord.employee,
          nextSnapshot,
          previousSnapshot,
          requestedFields: Array.from(touched),
          salaryPeriod: savedRecord.salaryPeriod,
          salaryRecord: savedRecord,
        }),
      );
    }

    return {
      month: record.salaryPeriod.month,
      year: record.salaryPeriod.year,
    };
  }

  async listPeriodHistory(periodId: string) {
    const histories = await this.recordHistoryRepository.find({
      where: { salaryPeriod: { id: periodId } },
      relations: { employee: true, salaryPeriod: true, salaryRecord: true },
      order: { createdAt: "DESC" },
      take: 100,
    });

    return histories.map((history) => this.toHistoryDto(history));
  }

  async revertHistory(historyId: string, user?: PayrollAuditUser) {
    const history = await this.recordHistoryRepository.findOne({
      where: { id: historyId },
      relations: { employee: true, salaryPeriod: true, salaryRecord: true },
    });
    if (!history) {
      throw new HttpError(404, "PAYROLL_RECORD_HISTORY_NOT_FOUND", "Không tìm thấy lịch sử sửa bảng lương");
    }

    const record = await this.recordRepository.findOne({
      where: { id: history.salaryRecord.id },
      relations: { employee: true, salaryPeriod: true },
    });
    if (!record) {
      throw new HttpError(404, "SALARY_RECORD_NOT_FOUND", "Không tìm thấy dòng bảng lương");
    }
    if (record.salaryPeriod.status === "locked" || record.status === "locked") {
      throw new HttpError(400, "PAYROLL_LOCKED", "Kỳ lương đã bị khóa");
    }

    const previousSnapshot = this.toSnapshot(record);
    this.applySnapshot(record, history.previousSnapshot);
    const savedRecord = await this.recordRepository.save(record);
    const nextSnapshot = this.toSnapshot(savedRecord);
    const changedFields = getChangedFields(previousSnapshot, nextSnapshot);

    if (changedFields.length > 0) {
      await this.recordHistoryRepository.save(
        this.recordHistoryRepository.create({
          action: "revert",
          changedByLoginCode: user?.loginCode ?? null,
          changedByUserId: user?.id ?? null,
          changedFields,
          employee: savedRecord.employee,
          nextSnapshot,
          previousSnapshot,
          requestedFields: history.changedFields,
          salaryPeriod: savedRecord.salaryPeriod,
          salaryRecord: savedRecord,
        }),
      );
    }

    return {
      month: savedRecord.salaryPeriod.month,
      year: savedRecord.salaryPeriod.year,
    };
  }

  private toState(record: SalaryRecord): PayrollRecordState {
    return {
      configuredSalary: Number(record.configuredSalary),
      insuranceSalary: Number(record.insuranceSalary),
      workDay: Number(record.workDay),
      fixedDailySalary: Number(record.fixedDailySalary),
      responsibilityAllowance: Number(record.responsibilityAllowance),
      mealAllowance: Number(record.mealAllowance),
      phoneAllowance: Number(record.phoneAllowance),
      kpiAllowance: Number(record.kpiAllowance),
      dailyTotal: Number(record.dailyTotal),
      overtimeWorkDay: Number(record.overtimeWorkDay),
      totalWorkDay: Number(record.totalWorkDay),
      earnedSalary: Number(record.baseSalary),
      overtimeTotal: Number(record.overtimeTotal),
      grossSalary: Number(record.grossSalary),
      employerInsuranceTotal: Number(record.employerInsuranceTotal),
      insuranceTotal: Number(record.insuranceTotal),
      taxTotal: Number(record.taxTotal),
      advanceTotal: Number(record.advanceTotal),
      deductionTotal: Number(record.deductionTotal),
      bonus: Number(record.bonus),
      netSalary: Number(record.netSalary),
    };
  }

  private async recalculateDerivedFields(state: PayrollRecordState, touched: Set<EditablePayrollField>) {
    const insuranceSalaryChanged = touched.has("insuranceSalary");
    const dailyComponentChanged = dailyComponentFields.some((field) => touched.has(field));
    const dailyTotalChanged = dailyComponentChanged || touched.has("dailyTotal");
    const workDayChanged = dayFields.some((field) => touched.has(field));
    let earnedSalaryChanged = touched.has("earnedSalary");
    let grossSalaryChanged = touched.has("grossSalary");
    let deductionTotalChanged = touched.has("deductionTotal");

    if (insuranceSalaryChanged) {
      const rates = await this.getInsuranceRates();
      if (!touched.has("employerInsuranceTotal")) {
        state.employerInsuranceTotal = roundCurrency(state.insuranceSalary * rates.employerRate);
      }
      if (!touched.has("insuranceTotal")) {
        state.insuranceTotal = roundCurrency(state.insuranceSalary * rates.employeeRate);
        touched.add("insuranceTotal");
      }
    }

    if (dailyComponentChanged && !touched.has("dailyTotal")) {
      state.dailyTotal = roundCurrency(sum(dailyComponentFields.map((field) => state[field])));
      touched.add("dailyTotal");
    }

    if (workDayChanged && !touched.has("totalWorkDay")) {
      state.totalWorkDay = roundNumber(state.workDay + state.overtimeWorkDay);
      touched.add("totalWorkDay");
    }

    if ((dailyTotalChanged || touched.has("workDay")) && !touched.has("earnedSalary")) {
      state.earnedSalary = roundCurrency(state.dailyTotal * state.workDay);
      earnedSalaryChanged = true;
      touched.add("earnedSalary");
    }

    if ((earnedSalaryChanged || touched.has("overtimeTotal")) && !touched.has("grossSalary")) {
      state.grossSalary = roundCurrency(state.earnedSalary + state.overtimeTotal);
      grossSalaryChanged = true;
      touched.add("grossSalary");
    }

    if (
      (touched.has("insuranceTotal") || touched.has("taxTotal") || touched.has("advanceTotal")) &&
      !touched.has("deductionTotal")
    ) {
      state.deductionTotal = roundCurrency(state.insuranceTotal + state.taxTotal + state.advanceTotal);
      deductionTotalChanged = true;
      touched.add("deductionTotal");
    }

    if ((grossSalaryChanged || deductionTotalChanged) && !touched.has("netSalary")) {
      state.netSalary = roundCurrency(Math.max(0, state.grossSalary - state.deductionTotal + state.bonus));
    }

    // If bonus changed but netSalary not explicitly set, recalculate
    if (touched.has("bonus") && !touched.has("netSalary")) {
      state.netSalary = roundCurrency(Math.max(0, state.grossSalary - state.deductionTotal + state.bonus));
    }
  }

  private async getInsuranceRates() {
    const setting = await this.formulaSettingRepository.findOne({
      where: {},
      order: { createdAt: "ASC" },
    });
    return {
      employeeRate: normalizeRate(Number(setting?.employeeInsuranceRate ?? DEFAULT_PAYROLL_FORMULA_SETTING.employeeInsuranceRate)),
      employerRate: normalizeRate(Number(setting?.employerInsuranceRate ?? DEFAULT_PAYROLL_FORMULA_SETTING.employerInsuranceRate)),
    };
  }

  private applyState(record: SalaryRecord, state: PayrollRecordState) {
    this.recordRepository.merge(record, {
      configuredSalary: String(state.configuredSalary),
      insuranceSalary: String(state.insuranceSalary),
      workDay: String(state.workDay),
      fixedDailySalary: String(state.fixedDailySalary),
      responsibilityAllowance: String(state.responsibilityAllowance),
      mealAllowance: String(state.mealAllowance),
      phoneAllowance: String(state.phoneAllowance),
      kpiAllowance: String(state.kpiAllowance),
      dailyTotal: String(state.dailyTotal),
      overtimeWorkDay: String(state.overtimeWorkDay),
      totalWorkDay: String(state.totalWorkDay),
      baseSalary: String(state.earnedSalary),
      overtimeTotal: String(state.overtimeTotal),
      grossSalary: String(state.grossSalary),
      employerInsuranceTotal: String(state.employerInsuranceTotal),
      insuranceTotal: String(state.insuranceTotal),
      totalInsurance: String(roundCurrency(state.employerInsuranceTotal + state.insuranceTotal)),
      taxTotal: String(state.taxTotal),
      advanceTotal: String(state.advanceTotal),
      deductionTotal: String(state.deductionTotal),
      bonus: String(state.bonus),
      netSalary: String(state.netSalary),
    });
  }

  private toSnapshot(record: SalaryRecord): PayrollRecordSnapshot {
    return {
      configuredSalary: Number(record.configuredSalary),
      insuranceSalary: Number(record.insuranceSalary),
      workDay: Number(record.workDay),
      standardWorkDay: Number(record.standardWorkDay),
      fixedDailySalary: Number(record.fixedDailySalary),
      responsibilityAllowance: Number(record.responsibilityAllowance),
      mealAllowance: Number(record.mealAllowance),
      phoneAllowance: Number(record.phoneAllowance),
      kpiAllowance: Number(record.kpiAllowance),
      dailyTotal: Number(record.dailyTotal),
      overtimeWorkDay: Number(record.overtimeWorkDay),
      totalWorkDay: Number(record.totalWorkDay),
      earnedSalary: Number(record.baseSalary),
      allowanceTotal: Number(record.allowanceTotal),
      bonusTotal: Number(record.bonusTotal),
      bonus: Number(record.bonus),
      overtimeTotal: Number(record.overtimeTotal),
      grossSalary: Number(record.grossSalary),
      employerInsuranceTotal: Number(record.employerInsuranceTotal),
      insuranceTotal: Number(record.insuranceTotal),
      totalInsurance: Number(record.totalInsurance),
      taxTotal: Number(record.taxTotal),
      advanceTotal: Number(record.advanceTotal),
      deductionTotal: Number(record.deductionTotal),
      netSalary: Number(record.netSalary),
      status: record.status,
    };
  }

  private applySnapshot(record: SalaryRecord, snapshot: PayrollRecordSnapshot) {
    this.recordRepository.merge(record, {
      configuredSalary: String(snapshot.configuredSalary),
      insuranceSalary: String(snapshot.insuranceSalary),
      workDay: String(snapshot.workDay),
      standardWorkDay: String(snapshot.standardWorkDay),
      fixedDailySalary: String(snapshot.fixedDailySalary),
      responsibilityAllowance: String(snapshot.responsibilityAllowance),
      mealAllowance: String(snapshot.mealAllowance),
      phoneAllowance: String(snapshot.phoneAllowance),
      kpiAllowance: String(snapshot.kpiAllowance),
      dailyTotal: String(snapshot.dailyTotal),
      overtimeWorkDay: String(snapshot.overtimeWorkDay),
      totalWorkDay: String(snapshot.totalWorkDay),
      baseSalary: String(snapshot.earnedSalary),
      allowanceTotal: String(snapshot.allowanceTotal),
      bonusTotal: String(snapshot.bonusTotal),
      bonus: String(snapshot.bonus ?? 0),
      overtimeTotal: String(snapshot.overtimeTotal),
      grossSalary: String(snapshot.grossSalary),
      employerInsuranceTotal: String(snapshot.employerInsuranceTotal),
      insuranceTotal: String(snapshot.insuranceTotal),
      totalInsurance: String(snapshot.totalInsurance),
      taxTotal: String(snapshot.taxTotal),
      advanceTotal: String(snapshot.advanceTotal),
      deductionTotal: String(snapshot.deductionTotal),
      netSalary: String(snapshot.netSalary),
      status: snapshot.status,
    });
  }

  private toHistoryDto(history: PayrollRecordHistory) {
    return {
      id: history.id,
      action: history.action,
      periodId: history.salaryPeriod?.id,
      month: history.salaryPeriod?.month,
      year: history.salaryPeriod?.year,
      recordId: history.salaryRecord?.id,
      employeeId: history.employee?.id,
      employeeCode: history.employee?.employeeCode,
      employeeName: history.employee?.fullName,
      requestedFields: history.requestedFields,
      changedFields: history.changedFields,
      previousSnapshot: history.previousSnapshot,
      nextSnapshot: history.nextSnapshot,
      changedByLoginCode: history.changedByLoginCode ?? undefined,
      createdAt: history.createdAt,
    };
  }
}

const payrollSnapshotFields: Array<keyof PayrollRecordSnapshot> = [
  "configuredSalary",
  "insuranceSalary",
  "workDay",
  "standardWorkDay",
  "fixedDailySalary",
  "responsibilityAllowance",
  "mealAllowance",
  "phoneAllowance",
  "kpiAllowance",
  "dailyTotal",
  "overtimeWorkDay",
  "totalWorkDay",
  "earnedSalary",
  "allowanceTotal",
  "bonusTotal",
  "bonus",
  "overtimeTotal",
  "grossSalary",
  "employerInsuranceTotal",
  "insuranceTotal",
  "totalInsurance",
  "taxTotal",
  "advanceTotal",
  "deductionTotal",
  "netSalary",
];

function getChangedFields(previousSnapshot: PayrollRecordSnapshot, nextSnapshot: PayrollRecordSnapshot) {
  return payrollSnapshotFields.filter((field) => {
    const previousValue = Number(previousSnapshot[field]);
    const nextValue = Number(nextSnapshot[field]);
    return Math.abs(previousValue - nextValue) >= 0.01;
  });
}

function sanitizePayrollValue(field: EditablePayrollField, value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  if (dayFields.includes(field)) {
    return Math.min(62, Math.max(0, roundNumber(numericValue)));
  }

  return Math.min(1_000_000_000, Math.max(0, roundCurrency(numericValue)));
}

function normalizeRate(value: number) {
  return value > 1 ? value / 100 : value;
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
