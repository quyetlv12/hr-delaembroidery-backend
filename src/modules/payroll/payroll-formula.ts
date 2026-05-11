import type { Allowance, Deduction } from "../../entities";

export const DEFAULT_INSURANCE_SALARY = 5_062_000;

const EMPLOYEE_SOCIAL_INSURANCE_RATE = 0.08;
const EMPLOYEE_HEALTH_INSURANCE_RATE = 0.015;
const EMPLOYEE_UNEMPLOYMENT_INSURANCE_RATE = 0.01;
const EMPLOYEE_INSURANCE_RATE =
  EMPLOYEE_SOCIAL_INSURANCE_RATE + EMPLOYEE_HEALTH_INSURANCE_RATE + EMPLOYEE_UNEMPLOYMENT_INSURANCE_RATE;
const EMPLOYER_SOCIAL_INSURANCE_RATE = 0.175;
const EMPLOYER_HEALTH_INSURANCE_RATE = 0.03;
const EMPLOYER_UNEMPLOYMENT_INSURANCE_RATE = 0.01;
const EMPLOYER_INSURANCE_RATE =
  EMPLOYER_SOCIAL_INSURANCE_RATE + EMPLOYER_HEALTH_INSURANCE_RATE + EMPLOYER_UNEMPLOYMENT_INSURANCE_RATE;
const HOURS_PER_WORK_DAY = 8;

type PayrollFormulaInput = {
  actualSalary: number;
  workDay: number;
  standardWorkDay: number;
  overtimeMinutes: number;
  overtimeRate: number;
  holidayBonusTotal?: number;
  insuranceSalary?: number;
  allowances?: Pick<Allowance, "name" | "amount">[];
  deductions?: Pick<Deduction, "name" | "amount">[];
};

export type PayrollFormulaResult = {
  actualSalary: number;
  insuranceSalary: number;
  dailyActualSalary: number;
  fixedDailySalary: number;
  responsibilityAllowance: number;
  mealAllowance: number;
  phoneAllowance: number;
  kpiAllowance: number;
  dailyTotal: number;
  workDay: number;
  standardWorkDay: number;
  overtimeWorkDay: number;
  totalWorkDay: number;
  earnedSalary: number;
  overtimeSalary: number;
  grossSalary: number;
  allowanceTotal: number;
  bonusTotal: number;
  employerSocialInsurance: number;
  employerHealthInsurance: number;
  employerUnemploymentInsurance: number;
  employerInsuranceTotal: number;
  employeeSocialInsurance: number;
  employeeHealthInsurance: number;
  employeeUnemploymentInsurance: number;
  employeeInsuranceTotal: number;
  totalInsurance: number;
  employeeInsuranceDeduction: number;
  personalIncomeTax: number;
  advanceTotal: number;
  totalDeduction: number;
  netSalary: number;
};

export function calculateExcelPayroll(input: PayrollFormulaInput): PayrollFormulaResult {
  const actualSalary = sanitizeMoney(input.actualSalary);
  const workDay = roundNumber(input.workDay);
  const standardWorkDay = input.standardWorkDay > 0 ? roundNumber(input.standardWorkDay) : 0;
  const insuranceSalary = sanitizeMoney(input.insuranceSalary ?? (actualSalary > 0 ? DEFAULT_INSURANCE_SALARY : 0));
  const bonusTotal = roundCurrency(input.holidayBonusTotal ?? 0);
  const allowances = splitAllowances(input.allowances ?? []);
  const deductions = splitDeductions(input.deductions ?? []);

  const dailyActualSalary = standardWorkDay > 0 ? actualSalary / standardWorkDay : 0;
  const fixedDailySalary = standardWorkDay > 0 ? insuranceSalary / standardWorkDay : 0;
  const responsibilityAllowance = toDailyAmount(allowances.responsibility, workDay);
  const mealAllowance = toDailyAmount(allowances.meal, workDay);
  const phoneAllowance = toDailyAmount(allowances.phone, workDay);
  const baseKpiAllowance = Math.max(0, dailyActualSalary - fixedDailySalary);
  const kpiAllowance =
    baseKpiAllowance + toDailyAmount(allowances.kpi + allowances.other + bonusTotal, workDay);
  const dailyTotal = fixedDailySalary + responsibilityAllowance + mealAllowance + phoneAllowance + kpiAllowance;
  const overtimeWorkDay = roundNumber(input.overtimeMinutes / 60 / HOURS_PER_WORK_DAY);
  const totalWorkDay = roundNumber(workDay + overtimeWorkDay);
  const hourlyRate = dailyActualSalary / HOURS_PER_WORK_DAY;
  const earnedSalary = roundCurrency(dailyTotal * workDay);
  const overtimeSalary = roundCurrency((input.overtimeMinutes / 60) * hourlyRate * input.overtimeRate);
  const grossSalary = roundCurrency(earnedSalary + overtimeSalary);

  const employerSocialInsurance = roundCurrency(insuranceSalary * EMPLOYER_SOCIAL_INSURANCE_RATE);
  const employerHealthInsurance = roundCurrency(insuranceSalary * EMPLOYER_HEALTH_INSURANCE_RATE);
  const employerUnemploymentInsurance = roundCurrency(insuranceSalary * EMPLOYER_UNEMPLOYMENT_INSURANCE_RATE);
  const employerInsuranceTotal = roundCurrency(insuranceSalary * EMPLOYER_INSURANCE_RATE);
  const employeeSocialInsurance = roundCurrency(insuranceSalary * EMPLOYEE_SOCIAL_INSURANCE_RATE);
  const employeeHealthInsurance = roundCurrency(insuranceSalary * EMPLOYEE_HEALTH_INSURANCE_RATE);
  const employeeUnemploymentInsurance = roundCurrency(insuranceSalary * EMPLOYEE_UNEMPLOYMENT_INSURANCE_RATE);
  const employeeInsuranceTotal = roundCurrency(insuranceSalary * EMPLOYEE_INSURANCE_RATE);
  const totalInsurance = roundCurrency(employerInsuranceTotal + employeeInsuranceTotal);
  const personalIncomeTax = roundCurrency(deductions.tax);
  const advanceTotal = roundCurrency(deductions.advance);
  const employeeInsuranceDeduction = employeeInsuranceTotal;
  const totalDeduction = roundCurrency(employeeInsuranceDeduction + personalIncomeTax + advanceTotal);
  const netSalary = roundCurrency(grossSalary - totalDeduction);

  return {
    actualSalary,
    insuranceSalary,
    dailyActualSalary,
    fixedDailySalary,
    responsibilityAllowance,
    mealAllowance,
    phoneAllowance,
    kpiAllowance,
    dailyTotal,
    workDay,
    standardWorkDay,
    overtimeWorkDay,
    totalWorkDay,
    earnedSalary,
    overtimeSalary,
    grossSalary,
    allowanceTotal: roundCurrency(allowances.total),
    bonusTotal,
    employerSocialInsurance,
    employerHealthInsurance,
    employerUnemploymentInsurance,
    employerInsuranceTotal,
    employeeSocialInsurance,
    employeeHealthInsurance,
    employeeUnemploymentInsurance,
    employeeInsuranceTotal,
    totalInsurance,
    employeeInsuranceDeduction,
    personalIncomeTax,
    advanceTotal,
    totalDeduction,
    netSalary,
  };
}

function splitAllowances(allowances: Pick<Allowance, "name" | "amount">[]) {
  const result = {
    responsibility: 0,
    meal: 0,
    phone: 0,
    kpi: 0,
    other: 0,
    total: 0,
  };

  for (const allowance of allowances) {
    const amount = sanitizeMoney(Number(allowance.amount));
    const name = normalizeText(allowance.name);
    result.total += amount;

    if (name.includes("trach nhiem")) {
      result.responsibility += amount;
      continue;
    }

    if (name.includes("an ca") || name.includes("com") || name.includes("bua")) {
      result.meal += amount;
      continue;
    }

    if (name.includes("dien thoai") || name.includes("phone")) {
      result.phone += amount;
      continue;
    }

    if (name.includes("kpi")) {
      result.kpi += amount;
      continue;
    }

    result.other += amount;
  }

  return result;
}

function splitDeductions(deductions: Pick<Deduction, "name" | "amount">[]) {
  const result = {
    tax: 0,
    advance: 0,
  };

  for (const deduction of deductions) {
    const amount = sanitizeMoney(Number(deduction.amount));
    const name = normalizeText(deduction.name);

    if (name.includes("thue") || name.includes("tncn")) {
      result.tax += amount;
      continue;
    }

    result.advance += amount;
  }

  return result;
}

function toDailyAmount(amount: number, workDay: number) {
  if (amount <= 0 || workDay <= 0) {
    return 0;
  }

  return amount / workDay;
}

function sanitizeMoney(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("vi-VN")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function roundCurrency(value: number) {
  return Math.round(value);
}

function roundNumber(value: number) {
  return Math.round(value * 100) / 100;
}
