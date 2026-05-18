import { z } from "zod";

const optionalUuid = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().uuid().optional(),
);

const optionalPassword = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(8).optional(),
);

export const createEmployeeDto = z.object({
  employeeCode: z.string().min(1),
  timekeepingCode: z.string().optional(),
  fullName: z.string().min(2),
  gender: z.enum(["male", "female", "other"]),
  birthday: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  cccd: z.string().optional(),
  address: z.string().optional(),
  departmentId: optionalUuid,
  positionId: optionalUuid,
  joinDate: z.string().min(1),
  contractType: z.string().optional(),
  shiftCount: z.coerce.number().int().min(1).max(3).default(2),
  salary: z.coerce.number().min(0),
  bankAccount: z.string().optional(),
  bankName: z.string().optional(),
  loginPassword: optionalPassword,
  taxCode: z.string().optional(),
  insuranceCode: z.string().optional(),
  status: z.enum(["active", "inactive", "probation"]).default("active"),
});

export const updateEmployeeSalaryDto = z.object({
  salary: z.coerce.number().min(0).max(1_000_000_000),
});

export const updateEmployeeMonthlyBonusDto = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
  amount: z.coerce.number().min(0).max(1_000_000_000),
});

export const increaseEmployeeSalaryDto = z.object({
  mode: z.enum(["percent", "amount"]),
  value: z.coerce.number().positive().max(1_000_000_000),
  employeeIds: z.array(z.string().uuid()).optional(),
});

export type CreateEmployeeDto = z.infer<typeof createEmployeeDto>;
export type UpdateEmployeeDto = CreateEmployeeDto;
export type UpdateEmployeeSalaryDto = z.infer<typeof updateEmployeeSalaryDto>;
export type UpdateEmployeeMonthlyBonusDto = z.infer<typeof updateEmployeeMonthlyBonusDto>;
export type IncreaseEmployeeSalaryDto = z.infer<typeof increaseEmployeeSalaryDto>;
