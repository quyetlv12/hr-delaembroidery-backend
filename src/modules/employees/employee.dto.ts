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

export type CreateEmployeeDto = z.infer<typeof createEmployeeDto>;
export type UpdateEmployeeDto = CreateEmployeeDto;
