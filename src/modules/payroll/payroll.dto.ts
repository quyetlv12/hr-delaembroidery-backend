import { z } from "zod";

export const payrollFormulaColumnKeys = [
  "fixedDailySalary",
  "responsibilityAllowance",
  "mealAllowance",
  "phoneAllowance",
  "kpiAllowance",
  "dailyTotal",
  "earnedSalary",
  "overtimeTotal",
  "grossSalary",
  "employerInsuranceTotal",
  "insuranceTotal",
  "taxTotal",
  "advanceTotal",
  "deductionTotal",
  "netSalary",
] as const;

export const payrollFormulaColumnDto = z.object({
  key: z.enum(payrollFormulaColumnKeys),
  name: z.string().trim().min(1),
  formula: z.string().trim().min(1),
});

export const payrollFormulaSettingDto = z.object({
  insuranceBaseSalary: z.coerce.number().min(0).max(1_000_000_000),
  employeeInsuranceRate: z.coerce.number().min(0).max(100),
  employerInsuranceRate: z.coerce.number().min(0).max(100),
  defaultMealAllowance: z.coerce.number().min(0).max(1_000_000_000),
  defaultPhoneAllowance: z.coerce.number().min(0).max(1_000_000_000),
  columnFormulas: z.array(payrollFormulaColumnDto).min(1),
});

export const payrollPeriodDto = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
  formulaSetting: payrollFormulaSettingDto.optional(),
});

export const payrollFormulaTemplateCreateDto = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(255).optional(),
  setting: payrollFormulaSettingDto,
});

export const payrollRecordUpdateDto = z
  .object({
    configuredSalary: z.coerce.number().min(0).max(1_000_000_000).optional(),
    insuranceSalary: z.coerce.number().min(0).max(1_000_000_000).optional(),
    workDay: z.coerce.number().min(0).max(31).optional(),
    fixedDailySalary: z.coerce.number().min(0).max(1_000_000_000).optional(),
    responsibilityAllowance: z.coerce.number().min(0).max(1_000_000_000).optional(),
    mealAllowance: z.coerce.number().min(0).max(1_000_000_000).optional(),
    phoneAllowance: z.coerce.number().min(0).max(1_000_000_000).optional(),
    kpiAllowance: z.coerce.number().min(0).max(1_000_000_000).optional(),
    dailyTotal: z.coerce.number().min(0).max(1_000_000_000).optional(),
    overtimeWorkDay: z.coerce.number().min(0).max(31).optional(),
    totalWorkDay: z.coerce.number().min(0).max(62).optional(),
    earnedSalary: z.coerce.number().min(0).max(1_000_000_000).optional(),
    overtimeTotal: z.coerce.number().min(0).max(1_000_000_000).optional(),
    grossSalary: z.coerce.number().min(0).max(1_000_000_000).optional(),
    employerInsuranceTotal: z.coerce.number().min(0).max(1_000_000_000).optional(),
    insuranceTotal: z.coerce.number().min(0).max(1_000_000_000).optional(),
    taxTotal: z.coerce.number().min(0).max(1_000_000_000).optional(),
    advanceTotal: z.coerce.number().min(0).max(1_000_000_000).optional(),
    deductionTotal: z.coerce.number().min(0).max(1_000_000_000).optional(),
    bonus: z.coerce.number().min(0).max(1_000_000_000).optional(),
    netSalary: z.coerce.number().min(0).max(1_000_000_000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Vui lòng nhập dữ liệu cần cập nhật",
  });

export type PayrollPeriodDto = z.infer<typeof payrollPeriodDto>;
export type PayrollFormulaColumnKey = (typeof payrollFormulaColumnKeys)[number];
export type PayrollFormulaColumnDto = z.infer<typeof payrollFormulaColumnDto>;
export type PayrollFormulaSettingDto = z.infer<typeof payrollFormulaSettingDto>;
export type PayrollFormulaTemplateCreateDto = z.infer<typeof payrollFormulaTemplateCreateDto>;
export type PayrollRecordUpdateDto = z.infer<typeof payrollRecordUpdateDto>;
