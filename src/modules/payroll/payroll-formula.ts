import type { Allowance, Deduction } from "../../entities";
import type { PayrollFormulaColumnKey, PayrollFormulaSettingDto } from "./payroll.dto";

export const DEFAULT_INSURANCE_SALARY = 5_062_000;
export const DEFAULT_MEAL_ALLOWANCE = 30_000;
export const DEFAULT_PHONE_ALLOWANCE = 20_000;

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

export type PayrollColumnFormulaInput = {
  key: PayrollFormulaColumnKey;
  name: string;
  formula: string;
};

type PayrollColumnFormulaResult = PayrollColumnFormulaInput & {
  amount: number;
};

export const DEFAULT_PAYROLL_COLUMN_FORMULAS: PayrollColumnFormulaInput[] = [
  { key: "fixedDailySalary", name: "Lương cố định", formula: "baoHiemNgay" },
  { key: "responsibilityAllowance", name: "Trách nhiệm", formula: "phuCapTrachNhiem / ngayCong" },
  { key: "mealAllowance", name: "Ăn ca", formula: "anCaMacDinh" },
  { key: "phoneAllowance", name: "Điện thoại", formula: "dienThoaiMacDinh" },
  {
    key: "kpiAllowance",
    name: "KPI",
    formula: "(luongNgayThucHuong - baoHiemNgay) + (phuCapKpi + phuCapKhac + thuongLe) / ngayCong",
  },
  { key: "dailyTotal", name: "Tổng lương ngày", formula: "luongCoDinh + trachNhiem + anCa + dienThoai + kpi" },
  { key: "earnedSalary", name: "Lương trong tháng", formula: "tongLuongNgay * ngayCong" },
  { key: "overtimeTotal", name: "Lương tăng ca", formula: "soGioTangCa * luongNgayThucHuong / 8 * heSoOT" },
  { key: "grossSalary", name: "Tổng lương", formula: "luongThang + luongTangCa" },
  { key: "employerInsuranceTotal", name: "BHXH công ty", formula: "luongBHXH * tyLeBHXHCongTy / 100" },
  { key: "insuranceTotal", name: "BHXH NLĐ", formula: "luongBHXH * tyLeBHXHNLD / 100" },
  { key: "taxTotal", name: "Thuế TNCN", formula: "khauTruThue" },
  { key: "advanceTotal", name: "Tạm ứng", formula: "tamUng" },
  { key: "deductionTotal", name: "Tổng giảm trừ", formula: "bhxhNhanVien + thueTNCN + tamUng" },
  { key: "netSalary", name: "Thực nhận", formula: "tongLuong - tongGiamTru" },
];

export const DEFAULT_PAYROLL_FORMULA_SETTING: PayrollFormulaSettingDto = {
  insuranceBaseSalary: DEFAULT_INSURANCE_SALARY,
  employeeInsuranceRate: 10.5,
  employerInsuranceRate: 21.5,
  defaultMealAllowance: DEFAULT_MEAL_ALLOWANCE,
  defaultPhoneAllowance: DEFAULT_PHONE_ALLOWANCE,
  columnFormulas: DEFAULT_PAYROLL_COLUMN_FORMULAS,
};

type PayrollFormulaInput = {
  actualSalary: number;
  workDay: number;
  standardWorkDay: number;
  overtimeMinutes: number;
  overtimeRate: number;
  holidayBonusTotal?: number;
  insuranceSalary?: number;
  employeeInsuranceRate?: number;
  employerInsuranceRate?: number;
  defaultMealAllowance?: number;
  defaultPhoneAllowance?: number;
  formulas?: {
    columnFormulas?: PayrollColumnFormulaInput[];
  };
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
  formulaDetails: PayrollColumnFormulaResult[];
};

export function calculateExcelPayroll(input: PayrollFormulaInput): PayrollFormulaResult {
  const actualSalary = sanitizeMoney(input.actualSalary);
  const workDay = roundNumber(input.workDay);
  const standardWorkDay = input.standardWorkDay > 0 ? roundNumber(input.standardWorkDay) : 0;
  const insuranceSalary = sanitizeMoney(input.insuranceSalary ?? (actualSalary > 0 ? DEFAULT_INSURANCE_SALARY : 0));
  const employeeInsuranceRate = normalizeRate(input.employeeInsuranceRate, EMPLOYEE_INSURANCE_RATE);
  const employerInsuranceRate = normalizeRate(input.employerInsuranceRate, EMPLOYER_INSURANCE_RATE);
  const employeeInsurancePercent = normalizePercentValue(input.employeeInsuranceRate, EMPLOYEE_INSURANCE_RATE);
  const employerInsurancePercent = normalizePercentValue(input.employerInsuranceRate, EMPLOYER_INSURANCE_RATE);
  const defaultMealAllowance = sanitizeMoney(input.defaultMealAllowance ?? DEFAULT_MEAL_ALLOWANCE);
  const defaultPhoneAllowance = sanitizeMoney(input.defaultPhoneAllowance ?? DEFAULT_PHONE_ALLOWANCE);
  const bonusTotal = roundCurrency(input.holidayBonusTotal ?? 0);
  const allowances = splitAllowances(input.allowances ?? []);
  const mealAllowanceSource = allowances.meal > 0 ? allowances.meal : defaultMealAllowance * workDay;
  const phoneAllowanceSource = allowances.phone > 0 ? allowances.phone : defaultPhoneAllowance * workDay;
  const effectiveAllowanceTotal = allowances.responsibility + mealAllowanceSource + phoneAllowanceSource + allowances.kpi + allowances.other;
  const deductions = splitDeductions(input.deductions ?? []);

  const dailyActualSalary = standardWorkDay > 0 ? actualSalary / standardWorkDay : 0;
  const fixedDailySalaryFallback = standardWorkDay > 0 ? insuranceSalary / standardWorkDay : 0;
  const payrollVariables = {
    thucHuong: actualSalary,
    luongBHXH: insuranceSalary,
    congChuan: standardWorkDay,
    ngayCong: workDay,
    baoHiemNgay: fixedDailySalaryFallback,
    luongNgayThucHuong: dailyActualSalary,
    phuCapTrachNhiem: allowances.responsibility,
    phuCapAnCa: mealAllowanceSource,
    phuCapDienThoai: phoneAllowanceSource,
    anCaMacDinh: defaultMealAllowance,
    dienThoaiMacDinh: defaultPhoneAllowance,
    phuCapKpi: allowances.kpi,
    phuCapKhac: allowances.other,
    phuCap: effectiveAllowanceTotal,
    thuongLe: bonusTotal,
    soGioTangCa: input.overtimeMinutes / 60,
    heSoOT: input.overtimeRate,
    tyLeBHXHNLD: employeeInsurancePercent,
    tyLeBHXHCongTy: employerInsurancePercent,
    khauTruThue: deductions.tax,
    tamUng: deductions.advance,
  };
  const formulaVariables: Record<string, number> = { ...payrollVariables };
  const columnFormulaMap = createColumnFormulaMap(input.formulas?.columnFormulas);
  const formulaDetails: PayrollColumnFormulaResult[] = [];
  const evaluateColumn = (key: PayrollFormulaColumnKey, fallback: number) => {
    const formula = columnFormulaMap.get(key) ?? getDefaultColumnFormula(key);
    const amount = roundCurrency(evaluateFormula(formula?.formula, fallback, formulaVariables));
    assignColumnFormulaAliases(key, amount, formulaVariables);
    if (formula) {
      formulaDetails.push({ ...formula, amount });
    }
    return amount;
  };

  const fixedDailySalary = evaluateColumn("fixedDailySalary", fixedDailySalaryFallback);
  const responsibilityAllowance = evaluateColumn("responsibilityAllowance", 0);
  const mealAllowance = evaluateColumn("mealAllowance", 0);
  const phoneAllowance = evaluateColumn("phoneAllowance", 0);
  const kpiAllowance = evaluateColumn("kpiAllowance", 0);
  const dailyTotal = evaluateColumn(
    "dailyTotal",
    fixedDailySalary + responsibilityAllowance + mealAllowance + phoneAllowance + kpiAllowance,
  );
  const overtimeWorkDay = roundNumber(input.overtimeMinutes / 60 / HOURS_PER_WORK_DAY);
  const totalWorkDay = roundNumber(workDay + overtimeWorkDay);
  const hourlyRate = dailyActualSalary / HOURS_PER_WORK_DAY;
  const earnedSalary = evaluateColumn("earnedSalary", dailyTotal * workDay);
  const overtimeSalary = evaluateColumn("overtimeTotal", (input.overtimeMinutes / 60) * hourlyRate * input.overtimeRate);
  const grossSalary = evaluateColumn("grossSalary", earnedSalary + overtimeSalary);

  const employerSocialInsurance = roundCurrency(insuranceSalary * EMPLOYER_SOCIAL_INSURANCE_RATE);
  const employerHealthInsurance = roundCurrency(insuranceSalary * EMPLOYER_HEALTH_INSURANCE_RATE);
  const employerUnemploymentInsurance = roundCurrency(insuranceSalary * EMPLOYER_UNEMPLOYMENT_INSURANCE_RATE);
  const employerInsuranceTotal = evaluateColumn("employerInsuranceTotal", insuranceSalary * employerInsuranceRate);
  const employeeSocialInsurance = roundCurrency(insuranceSalary * EMPLOYEE_SOCIAL_INSURANCE_RATE);
  const employeeHealthInsurance = roundCurrency(insuranceSalary * EMPLOYEE_HEALTH_INSURANCE_RATE);
  const employeeUnemploymentInsurance = roundCurrency(insuranceSalary * EMPLOYEE_UNEMPLOYMENT_INSURANCE_RATE);
  const defaultEmployeeInsuranceTotal = roundCurrency(insuranceSalary * employeeInsuranceRate);
  const employeeInsuranceTotal = evaluateColumn("insuranceTotal", defaultEmployeeInsuranceTotal);
  const personalIncomeTax = evaluateColumn("taxTotal", roundCurrency(deductions.tax));
  const advanceTotal = evaluateColumn("advanceTotal", roundCurrency(deductions.advance));
  const employeeInsuranceDeduction = employeeInsuranceTotal;
  const totalInsurance = roundCurrency(employerInsuranceTotal + employeeInsuranceTotal);
  const totalDeduction = evaluateColumn("deductionTotal", employeeInsuranceTotal + personalIncomeTax + advanceTotal);
  const netSalary = evaluateColumn("netSalary", grossSalary - totalDeduction);

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
    allowanceTotal: roundCurrency(effectiveAllowanceTotal),
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
    formulaDetails,
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

function sanitizeMoney(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeRate(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  const numericValue = Number(value);
  return numericValue > 1 ? numericValue / 100 : numericValue;
}

function normalizePercentValue(value: number | undefined, fallbackRate: number) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallbackRate * 100;
  }

  return numericValue > 1 ? numericValue : numericValue * 100;
}

function createColumnFormulaMap(columnFormulas?: PayrollColumnFormulaInput[]) {
  const map = new Map<PayrollFormulaColumnKey, PayrollColumnFormulaInput>();

  for (const formula of DEFAULT_PAYROLL_COLUMN_FORMULAS) {
    map.set(formula.key, formula);
  }

  for (const formula of columnFormulas ?? []) {
    map.set(formula.key, {
      key: formula.key,
      name: formula.name.trim() || getDefaultColumnFormula(formula.key)?.name || formula.key,
      formula: formula.formula.trim(),
    });
  }

  return map;
}

function getDefaultColumnFormula(key: PayrollFormulaColumnKey) {
  return DEFAULT_PAYROLL_COLUMN_FORMULAS.find((formula) => formula.key === key);
}

function assignColumnFormulaAliases(
  key: PayrollFormulaColumnKey,
  value: number,
  variables: Record<string, number>,
) {
  variables[key] = value;

  const aliases: Record<PayrollFormulaColumnKey, string[]> = {
    fixedDailySalary: ["luongCoDinh"],
    responsibilityAllowance: ["trachNhiem"],
    mealAllowance: ["anCa"],
    phoneAllowance: ["dienThoai"],
    kpiAllowance: ["kpi"],
    dailyTotal: ["luongNgay", "tongLuongNgay"],
    earnedSalary: ["luongCong", "luongThang", "luongTrongThang"],
    overtimeTotal: ["luongTangCa"],
    grossSalary: ["tongLuong"],
    employerInsuranceTotal: ["bhxhCongTy"],
    insuranceTotal: ["bhxhNhanVien"],
    taxTotal: ["thueTNCN"],
    advanceTotal: ["tamUng"],
    deductionTotal: ["tongGiamTru"],
    netSalary: ["thucNhan"],
  };

  for (const alias of aliases[key]) {
    variables[alias] = value;
  }
}

function evaluateFormula(expression: string | undefined, fallback: number, variables: Record<string, number>) {
  const normalizedExpression = normalizeFormulaExpression(expression);
  if (!normalizedExpression) {
    return fallback;
  }

  try {
    const result = parseFormulaExpression(normalizedExpression, variables);
    return Number.isFinite(result) ? result : fallback;
  } catch {
    return fallback;
  }
}

function normalizeFormulaExpression(expression: string | undefined) {
  const trimmedExpression = expression?.trim();
  if (!trimmedExpression) {
    return "";
  }

  const equalIndex = trimmedExpression.indexOf("=");
  return equalIndex >= 0 ? trimmedExpression.slice(equalIndex + 1).trim() : trimmedExpression;
}

function parseFormulaExpression(expression: string, variables: Record<string, number>) {
  let index = 0;

  function skipSpaces() {
    while (/\s/.test(expression[index] ?? "")) {
      index += 1;
    }
  }

  function parseExpression(): number {
    let value = parseTerm();
    while (true) {
      skipSpaces();
      const operator = expression[index];
      if (operator !== "+" && operator !== "-") {
        return value;
      }
      index += 1;
      const rightValue = parseTerm();
      value = operator === "+" ? value + rightValue : value - rightValue;
    }
  }

  function parseTerm(): number {
    let value = parseFactor();
    while (true) {
      skipSpaces();
      const operator = expression[index];
      if (operator !== "*" && operator !== "/") {
        return value;
      }
      index += 1;
      const rightValue = parseFactor();
      value = operator === "*" ? value * rightValue : value / rightValue;
    }
  }

  function parseFactor(): number {
    skipSpaces();
    const character = expression[index];

    if (character === "+") {
      index += 1;
      return parseFactor();
    }

    if (character === "-") {
      index += 1;
      return -parseFactor();
    }

    if (character === "(") {
      index += 1;
      const value = parseExpression();
      skipSpaces();
      if (expression[index] !== ")") {
        throw new Error("Invalid formula");
      }
      index += 1;
      return value;
    }

    if (/[0-9.]/.test(character ?? "")) {
      return parseNumber();
    }

    if (/[A-Za-z_]/.test(character ?? "")) {
      return parseVariable();
    }

    throw new Error("Invalid formula");
  }

  function parseNumber() {
    const startIndex = index;
    while (/[0-9.]/.test(expression[index] ?? "")) {
      index += 1;
    }
    const value = Number(expression.slice(startIndex, index));
    if (!Number.isFinite(value)) {
      throw new Error("Invalid formula");
    }
    return value;
  }

  function parseVariable() {
    const startIndex = index;
    while (/[A-Za-z0-9_]/.test(expression[index] ?? "")) {
      index += 1;
    }
    const name = expression.slice(startIndex, index);
    if (!(name in variables)) {
      throw new Error("Invalid formula");
    }
    return variables[name];
  }

  const result = parseExpression();
  skipSpaces();
  if (index !== expression.length) {
    throw new Error("Invalid formula");
  }

  return result;
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
