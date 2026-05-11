import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);

const optionalUuid = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().uuid().optional(),
);

export const saveDepartmentDto = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: optionalString,
});

export const savePositionDto = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  departmentId: optionalUuid,
});

export type SaveDepartmentDto = z.infer<typeof saveDepartmentDto>;
export type SavePositionDto = z.infer<typeof savePositionDto>;
