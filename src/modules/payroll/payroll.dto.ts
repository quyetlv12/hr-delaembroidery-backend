import { z } from "zod";

export const payrollPeriodDto = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

export const payrollFormulaCategoryDto = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Mã mục chỉ dùng chữ không dấu, số và dấu gạch dưới"),
  name: z.string().trim().min(1),
  formula: z.string().trim().min(1),
});

export const payrollFormulaSettingDto = z.object({
  insuranceBaseSalary: z.coerce.number().min(0).max(1_000_000_000),
  employeeInsuranceRate: z.coerce.number().min(0).max(100),
  employerInsuranceRate: z.coerce.number().min(0).max(100),
  earningCategories: z.array(payrollFormulaCategoryDto).min(1),
  deductionCategories: z.array(payrollFormulaCategoryDto).min(1),
  dailySalaryFormula: z.string().trim().min(1),
  grossSalaryFormula: z.string().trim().min(1),
  deductionFormula: z.string().trim().min(1),
  netSalaryFormula: z.string().trim().min(1),
});

export type PayrollPeriodDto = z.infer<typeof payrollPeriodDto>;
export type PayrollFormulaCategoryDto = z.infer<typeof payrollFormulaCategoryDto>;
export type PayrollFormulaSettingDto = z.infer<typeof payrollFormulaSettingDto>;
